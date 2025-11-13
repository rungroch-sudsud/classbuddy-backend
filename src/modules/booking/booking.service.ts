import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Booking } from './schemas/booking.schema';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Slot } from '../slots/schemas/slot.schema';
import { Notification } from '../notifications/schema/notification';
import { CreateBookingDto, MySlotResponse } from './schemas/booking.zod.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { User } from '../users/schemas/user.schema';
import dayjs from 'dayjs';
import 'dayjs/locale/th';


@Injectable()
export class BookingService {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
    ) { }


    async CreatebookingSlot(
        slotId: string,
        studentId: string,
        body: CreateBookingDto,
    ): Promise<Booking> {
        const studentObjId = new Types.ObjectId(studentId);
        const subjectObjId = new Types.ObjectId(body.subject)

        if (!Types.ObjectId.isValid(body.subject)) {
            throw new BadRequestException('subject id ไม่ถูกต้อง');
        }

        const slot = await this.slotModel.findById(slotId);
        if (!slot) throw new NotFoundException('ไม่พบ slot ที่ต้องการจอง');

        const existingBooking = await this.bookingModel.findOne({
            slotId: slot._id,
            studentId: studentObjId,
            status: 'pending'
        });

        if (existingBooking) throw new BadRequestException('คุณได้จอง slot นี้ไปแล้ว');

        if (slot.status !== 'available') {
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
            subject: subjectObjId
        });

        slot.status = 'pending';
        slot.bookingId = booking._id.toString();
        slot.bookedBy = studentObjId;
        slot.subject = subjectObjId
        await slot.save();

        return booking;
    }


    async getMySlot(userId: string): Promise<MySlotResponse[]> {
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
            .lean() as any;

        const sorted = bookings.sort((a, b) => {
            const statusOrder = { paid: 0, pending: 1 };
            const statusA = statusOrder[a.status] ?? 99;
            const statusB = statusOrder[b.status] ?? 99;

            if (statusA !== statusB) return statusA - statusB;
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

        return sorted.map(({ teacherId, startTime, endTime, date, paidAt, ...rest }) => {
            const teacher: any = teacherId;
            const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
            const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

            const dateDisplay = dayjs(startLocal).locale('th').format('D MMMM YYYY');
            const start = startLocal.format('HH:mm');
            const end = endLocal.format('HH:mm');
            const paidAtDisplay = paidAt ? dayjs(paidAt).locale('th').format('D MMMM YYYY') : null;

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
        });
    }


    async getBookingById(
        bookingId: string,
        userId: string
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

        if (userId !== booking.studentId.toString()) {
            throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงข้อมูลการจองนี้');
        }

        const teacher: any = booking.teacherId;
        const startLocal = dayjs.utc(booking.startTime).tz('Asia/Bangkok');
        const endLocal = dayjs.utc(booking.endTime).tz('Asia/Bangkok');

        const dateDisplay = dayjs(startLocal).locale('th').format('D MMMM YYYY');
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
        const bookings = await this.bookingModel
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
            .lean() as any;

        return bookings.map(({ teacherId, startTime, endTime, date, paidAt, ...rest }) => {
            const teacher: any = teacherId;

            const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
            const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

            const dateDisplay = dayjs(startLocal).locale('th').format('D MMMM YYYY');
            const start = startLocal.format('HH:mm');
            const end = endLocal.format('HH:mm');
            const paidAtDisplay = paidAt ? dayjs(paidAt).locale('th').format('D MMMM YYYY') : null;

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
        });
    }


}
