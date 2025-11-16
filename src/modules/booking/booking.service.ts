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
    NotificationReceipientType,
    NotificationType,
} from 'src/shared/enums/notification.enum';
import { SlotStatus } from 'src/shared/enums/slot.enum';
import {
    errorLog,
    getErrorMessage,
    infoLog,
    secondsToMilliseconds,
} from 'src/shared/utils/shared.util';
import { Role } from '../auth/role/role.enum';
import { ChatService } from '../chat/chat.service';
import { VideoService } from '../chat/video.service';
import { Notification } from '../notifications/schema/notification';
import {
    Payment,
    PaymentMethod,
    PaymentStatus,
} from '../payments/schemas/payment.schema';
import { Wallet } from '../payments/schemas/wallet.schema';
import { Slot } from '../slots/schemas/slot.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { Booking } from './schemas/booking.schema';
import { CreateBookingDto, MySlotResponse } from './schemas/booking.zod.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingService {
    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(Payment.name) private paymentModel: Model<Payment>,
        @InjectModel(Wallet.name) private walletModel: Model<Wallet>,
        @InjectModel(Notification.name)
        @InjectQueue('booking')
        private bookingQueue: Queue,
        private readonly notificationService: NotificationsService,
        private readonly chatService: ChatService,
        private readonly videoService: VideoService,
    ) {}

    private async _notifyBeforeClassStarts(booking: Booking) {
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

    private async _checkParticipantsBeforeClassEnds(booking: Booking) {
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

    async createBookingSlot(
        slotId: string,
        studentId: string,
        body: CreateBookingDto,
    ): Promise<Booking> {
        const studentObjId = new Types.ObjectId(studentId);
        const subjectObjId = new Types.ObjectId(body.subject);

        if (!Types.ObjectId.isValid(body.subject)) {
            throw new BadRequestException('subject id ไม่ถูกต้อง');
        }

        const slot = await this.slotModel.findById(slotId);
        if (!slot) throw new NotFoundException('ไม่พบ slot ที่ต้องการจอง');

        const existingBooking = await this.bookingModel.findOne({
            slotId: slot._id,
            studentId: studentObjId,
            status: 'pending',
        });

        if (existingBooking)
            throw new BadRequestException('คุณได้จอง slot นี้ไปแล้ว');

        if (slot.status !== SlotStatus.AVAILABLE) {
            throw new BadRequestException('Slot นี้ถูกจองหรือไม่ว่างแล้ว');
        }

        const booking = await this.bookingModel.create({
            studentId: studentObjId,
            teacherId: slot.teacherId,
            slotId: slot._id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            date: slot.date,
            price: slot.price,
            status: 'pending',
            subject: subjectObjId,
        });

        slot.status = SlotStatus.PENDING;
        slot.bookingId = booking._id;
        slot.bookedBy = studentObjId;
        slot.subject = subjectObjId;
        await slot.save();

        await this._notifyBeforeClassStarts(booking);

        await this._checkParticipantsBeforeClassEnds(booking);

        return booking;
    }

    async createBookingSlotByWallet(
        slotId: string,
        studentId: string,
        body: CreateBookingDto,
    ): Promise<Booking> {
        const session = await this.connection.startSession();

        try {
            infoLog('BOOKING', 'กำลังสร้าง booking ด้วย wallet');

            const booking = await this.createBookingSlot(
                slotId,
                studentId,
                body,
            );

            const createdBooking = await session.withTransaction(async () => {
                // 1 : ตรวจสอบยอดเงินของนักเรียนว่าพอหรือไม่
                const studentWallet = await this.walletModel
                    .findOne({
                        userId: studentId,
                        role: Role.User,
                    })
                    .session(session);

                if (!studentWallet)
                    throw new NotFoundException('ไม่พบกระเป๋าเงินของนักเรียน');

                const notEnoughBalance =
                    studentWallet.availableBalance < booking.price;

                if (notEnoughBalance)
                    throw new BadRequestException(
                        'ยอดคะแนนสะสมของคุณไม่เพียงพอ',
                    );

                // 2 : หักแต้มออกจาก wallet ของนักเรียน
                studentWallet.availableBalance -= booking.price;
                await studentWallet.save({ session });

                // 3 : บันทึก payment ว่าเกิดจากการชำระโดย wallet
                this.paymentModel.insertOne(
                    {
                        userId: booking.studentId,
                        teacherId: booking.teacherId,
                        bookingId: booking._id,
                        amount: booking.price,
                        method: PaymentMethod.WALLET,
                        status: PaymentStatus.SUCCESS,
                    },
                    { session },
                );

                // 4 : อัปเดตสถานะ Booking เป็น paid
                booking.status === 'paid';
                booking.paidAt = new Date();
                await booking.save({ session });

                // 5 : อัปเดตสถานะ slot เป็น paid
                await this.slotModel.findOneAndUpdate(
                    { bookingId: booking._id },
                    { status: SlotStatus.PAID, paidAt: new Date() },
                    { upsert: true, session },
                );

                // 6 : เพิ่มเงินเข้ากระเป๋าตังครู (pendingBalance)
                await this.walletModel.findOneAndUpdate(
                    {
                        userId: booking.teacherId,
                        role: Role.Teacher,
                    },
                    { $inc: { pendingBalance: booking.price } },
                    { upsert: true, session },
                );

                // 7 : สร้างแชทสำหรับครูและนักเรียน
                const teacherId = booking.teacherId.toString();
                await this.chatService.createOrGetChannel(studentId, teacherId);

                // 8 : สร้าง video room สำหรับคลาสนี้
                const bookingId = booking._id.toString();
                await this.videoService.createCallRoom(bookingId);

                // 9: ส่งแจ้งเตือนไปหาคุณครู และ นักเรียน
                const teacher = await this.teacherModel.findById(
                    booking.teacherId,
                );

                if (!teacher)
                    throw new NotFoundException('ไม่พบข้อมูลคุณครูของคลาสนี้');

                await this.notificationService.sendNotification(studentId, {
                    recipientType: NotificationReceipientType.User,
                    message: `ชำระเงินสำเร็จแล้ว 🎉 สามารถตรวจสอบตารางเรียนของคุณได้ที่ตารางของฉัน`,
                    type: NotificationType.BOOKING_PAID,
                });

                await this.notificationService.sendNotification(
                    teacher.userId.toString(),
                    {
                        recipientType: NotificationReceipientType.Teacher,
                        message: `มีนักเรียนจองตารางเรียนกับคุณแล้ว ✨ ตรวจสอบรายละเอียดการสอน`,
                        type: NotificationType.BOOKING_PAID,
                    },
                );

                infoLog('BOOKING', 'สร้าง Booking โดยชำระผ่าน Wallet สำเร็จ');

                return booking;
            });

            return createdBooking;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                'BOOKING',
                `ล้มเหลวระหว่างสร้าง Booking โดยใช้ wallet -> ${errorMessage}`,
            );

            throw new Error(errorMessage);
        } finally {
            session.endSession();
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
