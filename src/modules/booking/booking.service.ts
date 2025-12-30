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
import {
    createObjectId,
    errorLog,
    getErrorMessage,
    secondsToMilliseconds,
} from 'src/shared/utils/shared.util';
import { Slot } from '../slots/schemas/slot.schema';
import { SlotsService } from '../slots/slots.service';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { Booking } from './schemas/booking.schema';
import {
    ConfirmBookingDto,
    CreateBookingDto,
    MySlotResponse,
} from './schemas/booking.zod.schema';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from 'src/infra/sms/sms.service';
import { ChatService } from '../chat/chat.service';
import { SubjectList } from '../subjects/schemas/subject.schema';
import { SocketEvent } from 'src/shared/enums/socket.enum';
import { SocketService } from '../socket/socket.service';

@Injectable()
export class BookingService {
    constructor(
        @InjectQueue('booking') private bookingQueue: Queue,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(SubjectList.name) private subjectList: Model<SubjectList>,
        @InjectConnection() private readonly connection: Connection,
        private readonly slotsService: SlotsService,
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

        await this.bookingQueue.add(BullMQJob.END_CALL, booking, {
            delay: secondsToMilliseconds(secondsUntilClassEnds),
        });
    }

    private _calculateBookingPrice(
        teacherHourlyRate: number,
        startDate: Date,
        endDate: Date,
    ): number {
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
        console.log('body', body);

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
                    },
                    { session },
                );

                if (!createdBooking)
                    throw new InternalServerErrorException(
                        'สร้าง booking ไม่สำเร็จ',
                    );

                // 3 : ส่งข้อความเข้าไปในแชท ให้ครูกด ยืนยันหรือไม่

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

                await this.chatService.sendChatMessage({
                    channelId,
                    message: '',
                    senderUserId: studentId,
                    metadata: {
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
                    },
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
                        status: 'pending',
                        bookedBy: studentObjId,
                    },
                    { session },
                );

                // 2 : อัปเดตสถานะ Booking เป็น pending(รอจ่ายเงิน)
                booking.status = 'pending';
                booking.slotId = createdSlot._id.toString();
                await booking.save({ session });

                // 3 : ส่งข้อความการยืนยันการจองไปในแชท
                const channel = await this.chatService.createOrGetChannel(
                    studentObjId.toString(),
                    teacher.userId.toString(),
                );

                const channelId = channel.id;

                if (!channelId)
                    throw new InternalServerErrorException(
                        'ล้มเหลวระหว่างการสร้างบทสนทนา',
                    );

                await this.chatService.sendChatMessage({
                    channelId,
                    message: `
[การยืนยันการจอง] : คุณครูได้ยืนยันการจอง รหัส ${bookingId} เรียบร้อยแล้ว กรุณาชำระเงินภายใน 15 นาที
`,
                    senderUserId: teacher.userId.toString(),
                });

                // 4 : ส่ง Socket event ไปหานักเรียนและครู
                this.socketService.emit(SocketEvent.BOOKING_CONFIRMED, {
                    teacherUserId: teacher.userId.toString(),
                    studentId: studentObjId.toString(),
                    bookingId: booking._id.toString(),
                });
            });

            await this._addNotifyBeforeClassStartsQueue(booking);

            await this._addCheckParticipantsBeforeClassEndsQueue(booking);

            await this._addEndCallQueue(booking);

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

            await this.chatService.sendChatMessage({
                channelId,
                message: `
[ยกเลิกการจอง] : คุณครูได้ทำการยกเลิกการจอง รหัส ${bookingId} เรียบร้อยแล้ว
`,
                senderUserId: teacher.userId.toString(),
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
                status: { $in: ['pending', 'paid'] },
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName verifyStatus userId',
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

    async getAnyBookingHavingMyUserId(
        userId: string,
    ): Promise<MySlotResponse[]> {
        const currentUserTeacher = await this.teacherModel
            .findOne({ userId: createObjectId(userId) })
            .lean();
        if (!currentUserTeacher)
            throw new NotFoundException('ไม่พบข้อมูลครูดังกล่าว');

        const bookings = await this.bookingModel
            .find({
                $or: [
                    { studentId: createObjectId(userId) },
                    { teacherId: currentUserTeacher._id },
                ],
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName verifyStatus userId',
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
