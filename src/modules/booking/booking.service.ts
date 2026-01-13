import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { Connection, isValidObjectId, Model, Types } from 'mongoose';
import { BullMQJob } from 'src/shared/enums/bull-mq.enum';
import { SocketEvent } from 'src/shared/enums/socket.enum';
import {
    createObjectId,
    errorLog,
    generateUrl,
    getErrorMessage,
    secondsToMilliseconds,
} from 'src/shared/utils/shared.util';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Slot } from '../slots/schemas/slot.schema';
import { SlotsService } from '../slots/slots.service';
import { SocketService } from '../socket/socket.service';
import { SubjectList } from '../subjects/schemas/subject.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { User } from '../users/schemas/user.schema';
import { Booking } from './schemas/booking.schema';
import {
    AskForBookingFreeTrialDto,
    CreateBookingDto,
    MySlotResponse,
} from './schemas/booking.zod.schema';
import { ClassTrial } from '../classtrials/schemas/classtrial.schema';
import { BookingType } from 'src/shared/enums/booking.enum';
import { businessConfig } from 'src/configs/business.config';
import { SmsMessageBuilder } from 'src/infra/sms/builders/sms-builder.builder';
import { envConfig } from 'src/configs/env.config';
import { SmsService } from 'src/infra/sms/sms.service';

@Injectable()
export class BookingService {
    constructor(
        @InjectQueue('booking') private bookingQueue: Queue,
        @InjectQueue('video') private videoQueue: Queue,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(SubjectList.name) private subjectList: Model<SubjectList>,
        @InjectModel(ClassTrial.name)
        private classTrialModel: Model<ClassTrial>,
        @InjectConnection() private readonly connection: Connection,
        private readonly notificationService: NotificationsService,
        private readonly smsService: SmsService,
        private readonly chatService: ChatService,
        private readonly socketService: SocketService,
    ) {}

    private async _addNotifyBeforeClassStartsQueue(booking: Booking) {
        const now = dayjs();

        const secondsUntilClassStarts =
            dayjs(booking.startTime).unix() - now.unix();

        const secondsToNotifyUsersBeforeClass = 15 * 60; // : 15 นาทีก่อนคลาสเริ่่ม

        const secondsToNotifyUsers =
            secondsUntilClassStarts - secondsToNotifyUsersBeforeClass;

        await this.bookingQueue.add(BullMQJob.NOTIFY_BEFORE_CLASS, booking, {
            delay: secondsToMilliseconds(secondsToNotifyUsers),
        });
    }

    private async _addCheckParticipantsBeforeClassEndsQueue(booking: Booking) {
        const now = dayjs();

        const secondsUntilClassEnds =
            dayjs(booking.endTime).unix() - now.unix();

        const secondsToCheckBeforeClassEnds = 5 * 60; // : 5 นาทีก่อนเลิกคลาส

        const secondsToCheck =
            secondsUntilClassEnds - secondsToCheckBeforeClassEnds;

        await this.bookingQueue.add(
            BullMQJob.CHECK_PARTICIPANTS_BEFORE_CLASS_ENDS,
            booking,
            { delay: secondsToMilliseconds(secondsToCheck) },
        );
    }

    private async _addEndCallQueue(booking: Booking) {
        const now = dayjs();

        const secondsUntilClassEnds =
            dayjs(booking.endTime).unix() - now.unix();

        const additionalWrapUpSeconds = 10 * 60; // : เวลาสำหรับ wrapup 10 นาที

        const totalSecondsToEndCall =
            secondsUntilClassEnds + additionalWrapUpSeconds;

        await this.bookingQueue.add(BullMQJob.END_CALL, booking, {
            delay: secondsToMilliseconds(totalSecondsToEndCall),
        });
    }

    private async _addAutoCancelBookingQueue(booking: Booking) {
        const expirySeconds = businessConfig.payments.expiryMinutes * 60;

        await this.bookingQueue.add(BullMQJob.AUTO_CANCEL_BOOKING, booking, {
            delay: secondsToMilliseconds(expirySeconds),
            jobId: `${BullMQJob.AUTO_CANCEL_BOOKING}/${booking._id.toString()}`,
        });
    }

    private _calculateBookingPrice(
        teacherHourlyRate: number,
        startDate: Date,
        endDate: Date,
        bookingType: BookingType,
    ): number {
        if (bookingType === 'free_trial') return 0;

        const durationHours =
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

        const price = teacherHourlyRate * durationHours;

        return price;
    }

    private async _hasOverlapBookings({
        teacherId,
        date,
        studentId,
        endDate,
        startDate,
    }: {
        teacherId: Types.ObjectId;
        date: string;
        studentId: Types.ObjectId;
        endDate: Date;
        startDate: Date;
    }) {
        const hasOverlap = await this.bookingModel.exists({
            teacherId,
            date,
            // : นักเรียนคนเดียวกัน ต้องไม่สามารถส่งคำจองเวลาเดียวกันได้ (ไม่สามารถส่งคำขอซ้ำได้)
            // : นักเรียน ที่ต่างกัน สามารถขอจองเวลาเดียวกันได้ เพราะต้องรอครูยืนยัน
            studentId,
            $or: [
                {
                    startTime: { $lt: endDate },
                    endTime: { $gt: startDate },
                },
            ],
            // : นักเรียนต้องสามารถจองเวลาเดิมได้ หากคุณครูได้ทำการยกเลิก เวลานั้นไปแล้ว
            status: { $nin: ['canceled', 'expired'] },
        });

        return Boolean(hasOverlap);
    }

    async askForBookingConfirmation(studentId: string, body: CreateBookingDto) {
        const studentObjId = createObjectId(studentId);

        if (!Types.ObjectId.isValid(body.subject)) {
            throw new BadRequestException('subject id ไม่ถูกต้อง');
        }

        const startTime = dayjs.tz(
            `${body.date}T${body.startTime}`,
            'Asia/Bangkok',
        );

        let endTime = dayjs.tz(`${body.date}T${body.endTime}`, 'Asia/Bangkok');

        if (endTime.isSame(startTime)) {
            throw new BadRequestException(
                'เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน',
            );
        }

        if (endTime.isBefore(startTime)) {
            // ถ้าสิ้นสุดน้อยกว่าเริ่ม แสดงว่าข้ามเที่ยงคืน → auto +1 วัน
            endTime = endTime.add(1, 'day');
        }

        const startDateObj = startTime.toDate();
        const endDateObj = endTime.toDate();

        const session = await this.connection.startSession();

        try {
            await session.withTransaction(async () => {
                const teacher = await this.teacherModel
                    .findOne({ userId: createObjectId(body.teacherUserId) })
                    .session(session)
                    .lean();

                if (!teacher)
                    throw new NotFoundException('ไม่พบข้อมูลครูดังกล่าว');

                // // 1 : ตรวจสอบว่า slot นี้ถูกจองหรือไม่ว่างแล้ว
                // const hasOverlapSlots = await this.slotsService.hasOverlapSlots(
                //     teacher._id.toString(),
                //     body.date,
                //     endDateObj,
                //     startDateObj,
                // );

                // if (hasOverlapSlots)
                //     throw new BadRequestException(
                //         'เวลานี้ถูกจองหรือไม่ว่างแล้ว',
                //     );

                // 1 : ตรวจสอบว่าได้ส่ง คำขอ booking นี้ไปแล้วหรือไม่
                const hasOverlapBookings = await this._hasOverlapBookings({
                    teacherId: teacher._id,
                    date: body.date,
                    studentId: studentObjId,
                    endDate: endDateObj,
                    startDate: startDateObj,
                });

                if (hasOverlapBookings)
                    throw new BadRequestException(
                        'คุณได้ส่งคำขอ booking นี้ไปแล้ว',
                    );

                // 2 : สร้าง Booking สำหรับคลาสนี้
                const price = this._calculateBookingPrice(
                    teacher.hourlyRate,
                    startDateObj,
                    endDateObj,
                    'require_payment',
                );

                const createdBooking = await this.bookingModel.insertOne(
                    {
                        studentId: studentObjId,
                        teacherId: teacher._id,
                        date: body.date,
                        startTime: startDateObj,
                        endTime: endDateObj,
                        price,
                        subject: body.subject,
                        status: 'teacher_confirm_pending',
                        type: 'require_payment',
                    },
                    { session },
                );

                if (!createdBooking)
                    throw new InternalServerErrorException(
                        'สร้าง booking ไม่สำเร็จ',
                    );

                // 3 : ส่งข้อความเข้าไปในแชท ให้ครูกดยืนยันการจอง
                const channel = await this.chatService.createOrGetChannel(
                    studentId,
                    body.teacherUserId,
                );
                const channelId = channel.id;

                if (!channelId)
                    throw new InternalServerErrorException(
                        'ล้มเหลวระหว่างการสร้างบทสนทนา',
                    );

                const subject = await this.subjectList
                    .findById(body.subject)
                    .lean();

                if (!subject) throw new NotFoundException('ไม่พบวิชาดังกล่าว');

                const metadata: Record<string, any> = {
                    customMessageType: 'confirm-booking',
                    price,
                    startTime: startTime.format('YYYY-MM-DD HH:mm'),
                    endTime: endTime.format('YYYY-MM-DD HH:mm'),
                    teacherId: teacher._id.toString(),
                    subjectId: body.subject,
                    subjectName: subject.name,
                    studentId,
                    bookingId: createdBooking._id.toString(),
                    teacherUserId: teacher.userId.toString(),
                };

                const messageBuilder = new SmsMessageBuilder();

                const chatId = `stud_${studentId}_teac_${teacher.userId}`;
                const formattedClassDate = dayjs
                    .tz(startTime, 'Asia/Bangkok')
                    .format('DD/MM/YYYY');
                const startHours = dayjs
                    .tz(startTime, 'Asia/Bangkok')
                    .format('HH:mm');
                const endHours = dayjs
                    .tz(endTime, 'Asia/Bangkok')
                    .format('HH:mm');

                messageBuilder
                    .addText('[ยืนยันการจองคลาสเรียน]')
                    .newLine()
                    .addText(`รหัสการจอง : ${createdBooking._id.toString()}`)
                    .newLine()
                    .addText(`วันที่เรียน : ${formattedClassDate} `)
                    .newLine()
                    .addText(`เวลาเรียน : ${startHours} - ${endHours}`)
                    .newLine()
                    .addText(`วิชา : ${subject.name}`)
                    .newLine()
                    .addText(`ราคา : ${price}`)
                    .newLine()
                    .addText(
                        `ลิงค์อนุมัติการจองสำหรับคุณครู : ${envConfig.frontEndUrl}/chat/${chatId}`,
                    );

                const chatMessage = messageBuilder.getMessage();

                await this.chatService.sendChatMessage({
                    channelId,
                    message: chatMessage,
                    senderUserId: studentId,
                    metadata,
                });

                // 4 : ส่งแจ้งเตือนครูว่าให้ยืนยันการจอง
                const teacherUser = await this.userModel
                    .findById(teacher.userId)
                    .session(session)
                    .lean();

                if (!teacherUser)
                    throw new NotFoundException('ไม่พบข้อมูลผู้ใช้ของคุณครู');

                const teacherPushToken = teacherUser.expoPushToken;
                const teacherPhone = teacherUser.phone;

                let hasNotifiedTeacher: boolean = false;

                if (teacherPushToken) {
                    await this.notificationService.notify({
                        expoPushTokens: teacherPushToken,
                        title: 'มีนักเรียนจองตารางเรียนกับคุณแล้ว ✨',
                        body: 'กรุณายืนยันการจองตารางเรียน',
                    });

                    hasNotifiedTeacher = true;
                }

                if (!hasNotifiedTeacher) {
                    await this.smsService.sendSms(
                        teacherPhone,
                        'มีนักเรียนจองตารางเรียนกับคุณแล้ว ✨ กรุณายืนยันการจองตารางเรียน',
                    );

                    hasNotifiedTeacher = true;
                }

                // 5 : ส่งแจ้งเตือนนักเรียนว่าให้รอการยืนยันจากครู
                const student = await this.userModel
                    .findById(studentObjId)
                    .session(session)
                    .lean();

                if (!student)
                    throw new NotFoundException('ไม่พบข้อมูลนักเรียน');

                const studentPushToken = student.expoPushToken;
                const studentPhone = student.phone;

                let hasNotifiedStudent: boolean = false;

                if (studentPushToken) {
                    await this.notificationService.notify({
                        expoPushTokens: studentPushToken,
                        title: 'คุณได้ทำการจองตารางเรียนกับครูแล้ว ✨',
                        body: 'รอการยืนยันจากครู',
                    });

                    hasNotifiedStudent = true;
                }

                if (!hasNotifiedStudent) {
                    await this.smsService.sendSms(
                        studentPhone,
                        'คุณได้ทำการจองตารางเรียนกับครูแล้ว ✨ รอการยืนยันจากครู',
                    );

                    hasNotifiedStudent = true;
                }

                // 6 : ส่ง Socket event ไปหาทั้งครูและนักเรียน
                this.socketService.emit(SocketEvent.BOOKING_CREATED, {
                    teacherUserId: teacher.userId.toString(),
                    studentId: studentId,
                });
            });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างขอครูยืนยันการจอง Booking โดยใช้ askForBookingConfirmation -> ${errorMessage}`,
            );

            throw error;
        } finally {
            await session.endSession();
        }
    }

    async askForBookingFreeTrial(
        studentId: string,
        body: AskForBookingFreeTrialDto,
    ) {
        const studentObjId = createObjectId(studentId);

        if (!isValidObjectId(body.subject)) {
            throw new BadRequestException('subject id ไม่ถูกต้อง');
        }

        const startTime = dayjs.tz(
            `${body.date}T${body.startTime}`,
            'Asia/Bangkok',
        );

        const endTime = startTime.add(
            businessConfig.classroom.freeTrialMinutes,
            'minutes',
        );

        const startDateObj = startTime.toDate();
        const endDateObj = endTime.toDate();

        const session = await this.connection.startSession();

        try {
            await session.withTransaction(async () => {
                // 1 : เช็คว่าเคยเรียนฟรีกับครูคนนี้แล้วหรือยัง
                const teacher = await this.teacherModel
                    .findOne({ userId: createObjectId(body.teacherUserId) })
                    .session(session)
                    .lean();

                if (!teacher)
                    throw new NotFoundException('ไม่พบข้อมูลครูดังกล่าว');

                const foundTrial = await this.classTrialModel
                    .exists({
                        teacherId: teacher._id,
                        studentId: studentObjId,
                    })
                    .session(session);

                if (foundTrial)
                    throw new BadRequestException(
                        'คุณได้เรียนฟรีกับครูคนนี้ไปแล้ว',
                    );

                // 2 : เช็คว่าเดือนนี้ทดลองเกินที่ระบบกำหนดหรือไม่
                const startOfCurrentMonth = dayjs().startOf('month').toDate();
                const endOfCurrentMonth = dayjs().endOf('month').toDate();

                const trialsInCurrentMonthCount = await this.classTrialModel
                    .countDocuments({
                        studentId: studentObjId,
                        createdAt: {
                            $gte: startOfCurrentMonth,
                            $lte: endOfCurrentMonth,
                        },
                    })
                    .session(session);

                if (
                    trialsInCurrentMonthCount >=
                    businessConfig.classroom.maximumMontlyFreeTrials
                )
                    throw new BadRequestException(
                        `เดือนนี้คุณได้ทดลองเรียนครบ ${businessConfig.classroom.maximumMontlyFreeTrials} ครั้งแล้ว กรุณาลองอีกครั้งภายในเดือนหน้า`,
                    );

                // 3 : เช็คว่ามีคลาสที่ซ้อนทับกับคลาสนี้แล้วหรือไม่
                const hasOverlapBookings = await this._hasOverlapBookings({
                    teacherId: teacher._id,
                    date: body.date,
                    studentId: studentObjId,
                    endDate: endDateObj,
                    startDate: startDateObj,
                });

                if (hasOverlapBookings)
                    throw new BadRequestException(
                        'มีคลาสที่ซ้อนทับกับคลาสนี้แล้ว กรุณาลองอีกครั้ง',
                    );

                // 4 : สร้าง Booking สำหรับคลาสนี้
                const price: number = 0;

                const createdBooking = await this.bookingModel.insertOne(
                    {
                        studentId: studentObjId,
                        teacherId: teacher._id,
                        date: body.date,
                        startTime: startDateObj,
                        endTime: endDateObj,
                        price,
                        subject: body.subject,
                        status: 'teacher_confirm_pending',
                        type: 'free_trial',
                    },
                    { session },
                );

                if (!createdBooking)
                    throw new InternalServerErrorException(
                        'สร้าง booking ไม่สำเร็จ',
                    );

                // 5 : ส่งข้อความเข้าไปในแชท ให้ครูกดยืนยันการจอง
                const channel = await this.chatService.createOrGetChannel(
                    studentId,
                    body.teacherUserId,
                );
                const channelId = channel.id;

                if (!channelId)
                    throw new InternalServerErrorException(
                        'ล้มเหลวระหว่างการสร้างบทสนทนา',
                    );

                const subject = await this.subjectList
                    .findById(body.subject)
                    .lean();

                if (!subject) throw new NotFoundException('ไม่พบวิชาดังกล่าว');

                const metadata: Record<string, any> = {
                    customMessageType: 'confirm-booking',
                    price,
                    startTime: startTime.format('YYYY-MM-DD HH:mm'),
                    endTime: endTime.format('YYYY-MM-DD HH:mm'),
                    teacherId: teacher._id.toString(),
                    subjectId: body.subject,
                    subjectName: subject.name,
                    studentId,
                    bookingId: createdBooking._id.toString(),
                    teacherUserId: teacher.userId.toString(),
                };

                const messageBuilder = new SmsMessageBuilder();
                const chatId = `stud_${studentId}_teac_${teacher.userId}`;

                messageBuilder
                    .addText('[คำขอทดลองเรียนฟรี]')
                    .newLine()
                    .addText(`รหัสการจอง : ${createdBooking._id.toString()}`)
                    .newLine()
                    .addText(
                        `เริ่มเรียน : ${dayjs.tz(startTime, 'Asia/Bangkok').format('DD/MM/YYYY HH:mm')}`,
                    )
                    .newLine()
                    .addText(
                        `สิ้นสุด : ${dayjs.tz(endTime, 'Asia/Bangkok').format('DD/MM/YYYY HH:mm')}`,
                    )
                    .newLine()
                    .addText(`วิชา : ${subject.name}`)
                    .newLine()
                    .addText(`ราคา : ${price}`)
                    .newLine()
                    .addText(
                        `ลิงค์อนุมัติการจองสำหรับคุณครู : ${envConfig.frontEndUrl}/chat/${chatId}`,
                    );

                const chatMessage = messageBuilder.getMessage();

                await this.chatService.sendChatMessage({
                    channelId,
                    message: chatMessage,
                    senderUserId: studentId,
                    metadata,
                });

                // 6 : ส่งแจ้งเตือนครูว่าให้ยืนยันการจอง
                const teacherUser = await this.userModel
                    .findById(teacher.userId)
                    .session(session)
                    .lean();

                if (!teacherUser)
                    throw new NotFoundException('ไม่พบข้อมูลผู้ใช้ของคุณครู');

                const teacherPushToken = teacherUser.expoPushToken;
                const teacherPhone = teacherUser.phone;

                let hasNotifiedTeacher: boolean = false;

                if (teacherPushToken) {
                    await this.notificationService.notify({
                        expoPushTokens: teacherPushToken,
                        title: 'มีนักเรียนส่งคำขอทดลองเรียนฟรีกับคุณแล้ว ✨',
                        body: 'กรุณายืนยันการทดลองเรียนฟรี',
                    });

                    hasNotifiedTeacher = true;
                }

                if (!hasNotifiedTeacher) {
                    await this.smsService.sendSms(
                        teacherPhone,
                        'มีนักเรียนส่งคำขอทดลองเรียนฟรีกับคุณแล้ว ✨ กรุณายืนยันการทดลองเรียนฟรี',
                    );

                    hasNotifiedTeacher = true;
                }

                // 7 : ส่งแจ้งเตือนนักเรียนว่าให้รอการยืนยันจากครู
                const student = await this.userModel
                    .findById(studentObjId)
                    .session(session)
                    .lean();

                if (!student)
                    throw new NotFoundException('ไม่พบข้อมูลนักเรียน');

                const studentPushToken = student.expoPushToken;
                const studentPhone = student.phone;

                let hasNotifiedStudent: boolean = false;

                if (studentPushToken) {
                    await this.notificationService.notify({
                        expoPushTokens: studentPushToken,
                        title: 'คุณได้ส่งคำขอทดลองเรียนฟรีกับครูแล้ว ✨',
                        body: 'รอการยืนยันจากครูคนนี้',
                    });

                    hasNotifiedStudent = true;
                }

                if (!hasNotifiedStudent) {
                    await this.smsService.sendSms(
                        studentPhone,
                        'คุณได้ส่งคำขอทดลองเรียนฟรีกับครูแล้ว ✨ รอการยืนยันจากครูคนนี้',
                    );

                    hasNotifiedStudent = true;
                }

                // 6 : ส่ง Socket event ไปหาทั้งครูและนักเรียน
                this.socketService.emit(SocketEvent.BOOKING_CREATED, {
                    teacherUserId: teacher.userId.toString(),
                    studentId: studentId,
                });
            });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างขอครูยืนยันการจอง Booking โดยใช้ askForBookingConfirmation -> ${errorMessage}`,
            );

            throw error;
        } finally {
            await session.endSession();
        }
    }

    private async _sendBookingConfirmedMessage(
        booking: Booking,
        teacherUserId: string,
    ) {
        const bookingId = booking._id.toString();

        const channel = await this.chatService.createOrGetChannel(
            booking.studentId.toString(),
            teacherUserId,
        );

        const channelId = channel.id;

        if (!channelId)
            throw new InternalServerErrorException(
                'ล้มเหลวระหว่างการสร้างบทสนทนา',
            );

        const messageBuilder = new SmsMessageBuilder();

        messageBuilder
            .addText(
                booking.type === 'free_trial'
                    ? '[จองคลาสเรียนฟรีสำเร็จ] : '
                    : '[การยืนยันการจอง] : ',
            )
            .newLine()
            .addText(
                booking.type === 'free_trial'
                    ? `คุณครูได้ยืนยันการจอง รหัส ${bookingId} เรียบร้อยแล้ว`
                    : `คุณครูได้ยืนยันการจอง รหัส ${bookingId} เรียบร้อยแล้ว กรุณาชำระเงินภายใน ${businessConfig.payments.expiryMinutes} นาที`,
            );

        if (booking.type !== 'free_trial') {
            messageBuilder
                .newLine()
                .addText(
                    `ลิงค์ชำระเงิน : ${generateUrl(`${envConfig.frontEndUrl}/payment`, { bookingId })}`,
                );
        }

        const chatMessage = messageBuilder.getMessage();

        await this.chatService.sendChatMessage({
            channelId,
            message: chatMessage,
            senderUserId: teacherUserId,
        });
    }

    async confirmBooking(bookingId: string) {
        const session = await this.connection.startSession();

        const booking = await this.bookingModel
            .findById(bookingId)
            .session(session);

        if (!booking) throw new NotFoundException('ไม่พบข้อมูลการจอง');

        const subjectObjId = booking.subject;
        const studentObjId = booking.studentId;
        const teacherObjId = booking.teacherId;

        const teacher = await this.teacherModel
            .findById(teacherObjId)
            .lean()
            .session(session);

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครูดังกล่าว');

        const startDate = dayjs.tz(booking.startTime, 'Asia/Bangkok').toDate();
        const endDate = dayjs.tz(booking.endTime, 'Asia/Bangkok').toDate();

        try {
            await session.withTransaction(async () => {
                // 1 : สร้าง slot สำหรับคลาสเรียนนี้ (สถานะรอจ่ายเงิน)
                const price = this._calculateBookingPrice(
                    teacher.hourlyRate,
                    startDate,
                    endDate,
                    booking.type,
                );

                const createdSlot = await this.slotModel.insertOne(
                    {
                        teacherId: teacherObjId,
                        date: booking.date,
                        startTime: startDate,
                        bookingId: booking._id,
                        endTime: endDate,
                        price,
                        subject: subjectObjId,
                        status:
                            booking.type === 'free_trial' ? 'paid' : 'pending',
                        bookedBy: studentObjId,
                    },
                    { session },
                );

                // 2 : อัปเดตสถานะ Booking เป็น pending(รอจ่ายเงิน) หรือ paid(จ่ายเงินแล้ว เพราะฟรี)
                booking.status =
                    booking.type === 'free_trial' ? 'paid' : 'pending';

                booking.slotId = createdSlot._id.toString();

                await booking.save({ session });

                if (booking.type === 'free_trial')
                    await this.classTrialModel.insertOne({
                        teacherId: teacherObjId,
                        studentId: studentObjId,
                        bookingId: booking._id,
                    });

                // 4 : ส่งข้อความการยืนยันการจองไปในแชท
                const teacherUserId = teacher.userId.toString();

                await this._sendBookingConfirmedMessage(booking, teacherUserId);

                // 5 : ส่ง Socket event ไปหานักเรียนและครู
                this.socketService.emit(
                    booking.type === 'free_trial'
                        ? SocketEvent.BOOKING_PAID
                        : SocketEvent.BOOKING_CONFIRMED,
                    {
                        teacherUserId: teacherUserId,
                        studentId: studentObjId.toString(),
                        bookingId: booking._id.toString(),
                    },
                );

                if (booking.type === 'require_payment') {
                    await this._addAutoCancelBookingQueue(booking);
                }

                if (booking.type === 'free_trial')
                    await this.videoQueue.add(BullMQJob.CREATE_CALLROOM, {
                        bookingId: booking._id,
                    });

                await this._addNotifyBeforeClassStartsQueue(booking);

                await this._addCheckParticipantsBeforeClassEndsQueue(booking);

                await this._addEndCallQueue(booking);
            });

            return booking;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างยืนยันการจอง Booking โดยใช้ confirmBooking -> ${errorMessage}`,
            );

            throw error;
        } finally {
            await session.endSession();
        }
    }

    async cancelBooking(bookingId: string, currentUserId: string) {
        try {
            // 1 : เช็คว่าครูมีสิทธ์ ยกเลิก booking นี้หรือไม่
            const teacher = await this.teacherModel
                .findOne({ userId: createObjectId(currentUserId) })
                .lean();

            if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครูดังกล่าว');

            const booking = await this.bookingModel.findById(bookingId);
            if (!booking) throw new NotFoundException('ไม่พบข้อมูลการจอง');

            if (booking.teacherId.toString() !== teacher._id.toString())
                throw new UnauthorizedException(
                    'คุณไม่มีสิทธิ์ยกเลิกการจองนี้',
                );

            if (booking.status !== 'teacher_confirm_pending')
                throw new BadRequestException(
                    'สถานะไม่ถูกต้องสำหรับการยกเลิกการจอง',
                );

            // 2 : ปรับสถานะ Booking
            booking.status = 'canceled';
            await booking.save();

            // 3 : ส่งข้อความลงไปในแชทรวม
            const channel = await this.chatService.createOrGetChannel(
                booking.studentId.toString(),
                teacher.userId.toString(),
            );

            const channelId = channel.id;

            if (!channelId)
                throw new InternalServerErrorException(
                    'ล้มเหลวระหว่างการสร้างบทสนทนา',
                );

            const metadata: Record<string, any> = {
                customMessageType: 'booking-canceled',
                bookingId,
            };

            await this.chatService.sendChatMessage({
                channelId,
                message: `
[ยกเลิกการจอง] : คุณครูได้ทำการยกเลิกการจอง รหัส ${bookingId} เรียบร้อยแล้ว
`,
                senderUserId: teacher.userId.toString(),
                metadata,
            });

            // 4 : ส่ง notifcation ไปหานักเรียน

            // 5 : ส่ง notification ไปหาคุณครู

            // 6 : ส่ง Socket event ไปหานักเรียนและครู
            this.socketService.emit(SocketEvent.BOOKING_CANCELED, {
                teacherUserId: teacher.userId.toString(),
                studentId: booking.studentId.toString(),
            });
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างยกเลิกการจอง Booking โดยใช้ cancelBooking -> ${errorMessage}`,
            );
            throw error;
        }
    }

    async getMyStudentBookings(userId: string): Promise<MySlotResponse[]> {
        const bookings = await this.bookingModel
            .find({
                studentId: new Types.ObjectId(userId),
                status: { $in: ['pending', 'paid', 'studied'] },
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName verifyStatus userId reviews',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .lean<any>();

        const sorted = bookings.sort((a, b) => {
            const statusOrder = { paid: 0, pending: 1 };
            const statusA = statusOrder[a.status] ?? 99;
            const statusB = statusOrder[b.status] ?? 99;

            if (statusA !== statusB) return statusA - statusB;
            return (
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime()
            );
        });

        return sorted.map(
            ({ teacherId, startTime, endTime, date, paidAt, ...rest }) => {
                const teacher: any = teacherId;
                const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
                const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

                const dateDisplay = dayjs(startLocal)
                    .locale('th')
                    .format('D MMMM YYYY');
                const start = startLocal.format('HH:mm');
                const end = endLocal.format('HH:mm');
                const paidAtDisplay = paidAt
                    ? dayjs(paidAt).locale('th').format('D MMMM YYYY')
                    : null;

                const hasReviewed =
                    teacher.reviews.some(
                        (review) => review.reviewerId.toString() === userId,
                    ) ?? false;

                return {
                    ...rest,
                    date: dateDisplay,
                    startTime: start,
                    endTime: end,
                    paidAt: paidAtDisplay,
                    teacher: {
                        _id: teacher?._id,
                        name: teacher?.name,
                        lastName: teacher?.lastName,
                        verifyStatus: teacher?.verifyStatus,
                        profileImage: teacher?.userId?.profileImage ?? null,
                    },
                    hasReviewed,
                };
            },
        );
    }

    async getAnyBookingHavingMyUserId(
        userId: string,
    ): Promise<MySlotResponse[]> {
        const currentUserTeacher = await this.teacherModel
            .findOne({ userId: createObjectId(userId) })
            .lean();

        const bookings = await this.bookingModel
            .find({
                $or: [
                    { studentId: createObjectId(userId) },
                    { teacherId: currentUserTeacher?._id },
                ],
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName verifyStatus userId reviews',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .lean<any>();

        const sorted = bookings.sort((a, b) => {
            const statusOrder = { paid: 0, pending: 1 };
            const statusA = statusOrder[a.status] ?? 99;
            const statusB = statusOrder[b.status] ?? 99;

            if (statusA !== statusB) return statusA - statusB;
            return (
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime()
            );
        });

        return sorted.map(
            ({ teacherId, startTime, endTime, date, paidAt, ...rest }) => {
                const teacher: any = teacherId;
                const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
                const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

                const dateDisplay = dayjs(startLocal)
                    .locale('th')
                    .format('D MMMM YYYY');
                const start = startLocal.format('HH:mm');
                const end = endLocal.format('HH:mm');
                const paidAtDisplay = paidAt
                    ? dayjs(paidAt).locale('th').format('D MMMM YYYY')
                    : null;

                const hasReviewed =
                    teacher.reviews.some(
                        (review) => review.reviewerId.toString() === userId,
                    ) ?? false;
                return {
                    ...rest,
                    date: dateDisplay,
                    startTime: start,
                    endTime: end,
                    paidAt: paidAtDisplay,
                    teacher: {
                        _id: teacher?._id,
                        name: teacher?.name,
                        lastName: teacher?.lastName,
                        verifyStatus: teacher?.verifyStatus,
                        profileImage: teacher?.userId?.profileImage ?? null,
                    },
                    hasReviewed,
                };
            },
        );
    }

    async getBookingById(
        bookingId: string,
        userId: string,
    ): Promise<MySlotResponse> {
        if (!isValidObjectId(bookingId)) {
            throw new BadRequestException('Booking ID ไม่ถูกต้อง');
        }

        const booking = await this.bookingModel
            .findById(bookingId)
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName userId verifyStatus',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .lean();

        if (!booking) {
            throw new NotFoundException('ไม่พบข้อมูลการจอง');
        }

        const teacherRecord = await this.teacherModel.findOne({
            userId: new Types.ObjectId(userId),
        });

        const teacherFromBooking = await this.teacherModel
            .findById(booking.teacherId)
            .lean();

        const isStudent = userId === booking.studentId.toString();
        const isTeacher =
            teacherRecord &&
            teacherRecord._id.toString() === booking.teacherId?._id.toString();

        if (!isStudent && !isTeacher) {
            throw new ForbiddenException(
                'คุณไม่มีสิทธิ์เข้าถึงข้อมูลการจองนี้',
            );
        }

        const teacher: any = booking.teacherId;
        const startLocal = dayjs.utc(booking.startTime).tz('Asia/Bangkok');
        const endLocal = dayjs.utc(booking.endTime).tz('Asia/Bangkok');

        const dateDisplay = dayjs(startLocal)
            .locale('th')
            .format('D MMMM YYYY');
        const start = startLocal.format('HH:mm');
        const end = endLocal.format('HH:mm');

        const { teacherId, startTime, endTime, paidAt, ...rest } = booking;

        const paidAtDisplay = paidAt
            ? dayjs(paidAt).locale('th').format('D MMMM YYYY')
            : null;

        const hasReviewed =
            teacherFromBooking?.reviews.some(
                (review) => review.reviewerId.toString() === userId,
            ) ?? false;

        return {
            ...rest,
            date: dateDisplay,
            startTime: start,
            endTime: end,
            paidAt: paidAtDisplay,
            teacher: {
                _id: teacher?._id,
                name: teacher?.name,
                lastName: teacher?.lastName,
                verifyStatus: teacher?.verifyStatus,
                profileImage: teacher?.userId?.profileImage ?? null,
            },
            hasReviewed,
        };
    }

    async getHistoryBookingMine(userId: string): Promise<MySlotResponse[]> {
        const bookings = (await this.bookingModel
            .find({
                studentId: new Types.ObjectId(userId),
                status: { $in: ['studied', 'expired', 'rejected'] },
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName userId verifyStatus',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .sort({ startTime: -1 })
            .lean()) as any;

        return bookings.map(
            ({ teacherId, startTime, endTime, date, paidAt, ...rest }) => {
                const teacher: any = teacherId;

                const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
                const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

                const dateDisplay = dayjs(startLocal)
                    .locale('th')
                    .format('D MMMM YYYY');
                const start = startLocal.format('HH:mm');
                const end = endLocal.format('HH:mm');
                const paidAtDisplay = paidAt
                    ? dayjs(paidAt).locale('th').format('D MMMM YYYY')
                    : null;

                return {
                    ...rest,
                    date: dateDisplay,
                    startTime: start,
                    endTime: end,
                    paidAt: paidAtDisplay,
                    teacher: {
                        _id: teacher?._id,
                        name: teacher?.name,
                        lastName: teacher?.lastName,
                        verifyStatus: teacher?.verifyStatus,
                        profileImage: teacher?.userId?.profileImage ?? null,
                    },
                };
            },
        );
    }
}
