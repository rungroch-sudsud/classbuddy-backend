import { InjectQueue } from '@nestjs/bullmq';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
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
import { CreateBookingDto, MySlotResponse } from './schemas/booking.zod.schema';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from 'src/infra/sms/sms.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class BookingService {
    constructor(
        @InjectQueue('booking') private bookingQueue: Queue,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectConnection() private readonly connection: Connection,
        private readonly slotsService: SlotsService,
        private readonly notificationService: NotificationsService,
        private readonly smsService: SmsService,
        private readonly chatService: ChatService,
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
            (startDate.getTime() - endDate.getTime()) / (1000 * 60 * 60);

        const price = teacherHourlyRate * durationHours;

        return price;
    }

    async createBookingSlot(studentId: string, body: CreateBookingDto) {
        const studentObjId = createObjectId(studentId);
        const subjectObjId = createObjectId(body.subject);
        const teacherObjId = createObjectId(body.teacherId);

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
                // 1 : ตรวจสอบว่า slot นี้ถูกจองหรือไม่ว่างแล้ว
                const hasOverlap = await this.slotsService.hasOverlapSlots(
                    body.teacherId,
                    body.date,
                    endDateObj,
                    startDateObj,
                );

                // 2 : ถ้าไม่ว่างแล้วก็ให้ขึ้นเตือน user
                if (hasOverlap)
                    throw new BadRequestException(
                        'เวลานี้ถูกจองหรือไม่ว่างแล้ว',
                    );

                // 3 : สร้าง slot นี้ขึ้นมาใหม่ สถานะ available
                const teacher = await this.teacherModel
                    .findById(body.teacherId)
                    .session(session);

                if (!teacher)
                    throw new NotFoundException('ไม่พบข้อมูลครูดังกล่าว');

                const price = this._calculateBookingPrice(
                    teacher.hourlyRate,
                    startDateObj,
                    endDateObj,
                );

                const createdSlot = await this.slotModel.insertOne(
                    {
                        teacherId: createObjectId(body.teacherId),
                        date: body.date,
                        startTime: startDateObj,
                        endTime: endDateObj,
                        price,
                        subject: subjectObjId,
                        status: 'available',
                        bookedBy: studentObjId,
                    },
                    { session },
                );

                // 4 : สร้าง booking ที่มีสถานะ teacher_confirm_pending และแนบ slotId ด้วย
                await this.bookingModel.insertOne(
                    {
                        studentId: studentObjId,
                        teacherId: teacherObjId,
                        slotId: createdSlot._id.toString(),
                        date: body.date,
                        startTime: startDateObj,
                        endTime: endDateObj,
                        price,
                        subject: subjectObjId,
                        status: 'teacher_confirm_pending',
                    },
                    { session },
                );

                // 5 : ส่งข้อความเข้าไปในแชท ให้ครูกด ยืนยันหรือไม่
                const channel = await this.chatService.createOrGetChannel(
                    studentId,
                    body.teacherId,
                );
                const channelId = channel.id;

                if (channelId)
                    await this.chatService.sendChatMessage({
                        channelId,
                        message: `มีนักเรียนจองตารางเรียนกับคุณแล้ว ✨ กรุณายืนยันการจองตารางเรียน`,
                        senderUserId: studentId,
                        metadata: {
                            customMessageType: 'confirm-booking',
                        },
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
            });
            // 8 : ส่ง Queue เช็คว่า booking นี้ถูกยืนยันหรือไม่
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างสร้าง Booking โดยใช้ createBookingSlot -> ${errorMessage}`,
            );

            throw error;
        } finally {
            await session.endSession();
        }
    }

    async getMySlot(userId: string): Promise<MySlotResponse[]> {
        const bookings = (await this.bookingModel
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
            .lean()) as any;

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
