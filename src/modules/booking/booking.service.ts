import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Booking } from './schemas/booking.schema';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Slot } from '../slots/schemas/slot.schema';
import { Notification } from '../notifications/schema/notification';
import { CreateBookingDto } from './schemas/booking.zod.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { SubjectList } from '../subjects/schemas/subject.schema';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { User } from '../users/schemas/user.schema';
import { StreamChatService } from '../chat/stream-chat.service';


@Injectable()
export class BookingService {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(SubjectList.name) private subjectModel: Model<SubjectList>,
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
        private readonly streamChatService: StreamChatService
    ) { }


    // async bookSlot(
    //     slotId: string,
    //     studentId: string,
    // ): Promise<any> {
    //     const slot = await this.slotModel.findById(slotId);
    //     if (!slot) throw new NotFoundException('ไม่พบ slot ที่ต้องการจอง');

    //     if (slot.status !== 'available') {
    //         throw new BadRequestException('Slot นี้ถูกจองหรือไม่ว่างแล้ว');
    //     }

    //     const existingBooking = await this.bookingModel.findOne({
    //         studentId,
    //         slotId,
    //     });

    //     if (existingBooking) throw new BadRequestException('คุณได้จอง slot นี้ไปแล้ว');

    //     const booking = await this.bookingModel.create({
    //         studentId: new Types.ObjectId(studentId),
    //         teacherId: slot.teacherId,
    //         slotId: slot._id,
    //         startTime: slot.startTime,
    //         endTime: slot.endTime,
    //         date: slot.date,
    //         price: slot.price,
    //         status: 'pending',
    //     });

    //     // slot.status = 'booked';
    //     // slot.bookedBy = new Types.ObjectId(studentId);
    //     await slot.save();

    //     return booking;
    // }


    async getMySlot(userId: string) {
        const bookings = await this.bookingModel
            .find({
                studentId: new Types.ObjectId(userId),
                status: { $in: ['pending', 'wait_for_payment', 'paid'] },
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName userId',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .lean();

        const sorted = bookings.sort((a, b) => {
            const statusOrder = { paid: 0, wait_for_payment: 1, pending: 2 };
            const statusA = statusOrder[a.status] ?? 99;
            const statusB = statusOrder[b.status] ?? 99;

            if (statusA !== statusB) return statusA - statusB;
            return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        });

        return sorted.map(({ teacherId, startTime, endTime, ...rest }) => {
            const teacher: any = teacherId;
            const dateDisplay = dayjs(startTime).locale('th').format('D MMMM YYYY');
            const start = `${dayjs(startTime).format('HH:mm')}`;
            const end = `${dayjs(endTime).format('HH:mm')}`

            return {
                ...rest,
                teacher: {
                    _id: teacher?._id,
                    name: teacher?.name,
                    lastName: teacher?.lastName,
                    profileImage: teacher?.userId?.profileImage ?? null,
                },
                displayDate: {
                    date: dateDisplay,
                    startTime: start,
                    endTime: end
                },
            };
        });
    }


    async getBookingById(bookingId: string, userId: string) {
        if (!isValidObjectId(bookingId)) {
            throw new BadRequestException('Booking ID ไม่ถูกต้อง');
        }

        const booking = await this.bookingModel
            .findById(bookingId)
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName userId',
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

        const dateDisplay = dayjs(booking.startTime).locale('th').format('D MMMM YYYY');
        const start = `${dayjs(booking.startTime).format('HH:mm')}`;
        const end = `${dayjs(booking.endTime).format('HH:mm')}`

        const { teacherId, startTime, endTime, ...rest } = booking;

        return {
            ...rest,
            teacher: {
                _id: teacher?._id,
                name: teacher?.name,
                lastName: teacher?.lastName,
                profileImage: teacher?.userId?.profileImage ?? null,
            },
            displayDate: {
                date: dateDisplay,
                startTime: start,
                endTime: end
            },
        };
    }


    async getHistoryBookingMine(userId: string): Promise<any> {
        const bookings = await this.bookingModel
            .find({
                studentId: new Types.ObjectId(userId),
                status: { $in: ['studied', 'rejected'] },
            })
            .populate('subject', '_id name')
            .populate({
                path: 'teacherId',
                select: 'name lastName userId',
                populate: {
                    path: 'userId',
                    select: 'profileImage',
                },
            })
            .sort({ startTime: -1 })
            .lean();

        return bookings.map(({ teacherId, startTime, endTime, ...rest }) => {
            const teacher: any = teacherId;

            const dateDisplay = dayjs(startTime).locale('th').format('D MMMM YYYY');
            const start = `${dayjs(startTime).format('HH:mm')}`;
            const end = `${dayjs(endTime).format('HH:mm')}`;

            return {
                ...rest,
                teacher: {
                    _id: teacher?._id,
                    name: teacher?.name,
                    lastName: teacher?.lastName,
                    profileImage: teacher?.userId?.profileImage ?? null,
                },
                displayDate: {
                    date: dateDisplay,
                    startTime: start,
                    endTime: end
                },
            };
        });
    }


    async createBooking(
        userId: string,
        teacherId: string,
        body: CreateBookingDto
    ): Promise<any> {
        const teacher = await this.teacherModel.findById(teacherId).lean();
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        const subject = await this.subjectModel.findById(body.subject).lean();
        if (!subject) throw new NotFoundException('ไม่พบข้อมูลวิชา');

        const start = dayjs(`${body.date}T${body.startTime}`).toDate();
        const end = dayjs(`${body.date}T${body.endTime}`).toDate();

        if (end <= start) throw new BadRequestException('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');

        const overlap = await this.bookingModel.exists({
            teacherId: new Types.ObjectId(teacherId),
            startTime: { $lt: end },
            endTime: { $gt: start },
            status: { $in: ['pending', 'wait_for_payment', 'paid'] },
        });

        if (overlap) throw new BadRequestException('ช่วงเวลานี้ถูกจองแล้ว');

        const hours = dayjs(end).diff(dayjs(start), 'hour', true);
        const price = teacher.hourlyRate * hours;

        const booking = await this.bookingModel.create({
            studentId: new Types.ObjectId(userId),
            teacherId: new Types.ObjectId(teacherId),
            subject: new Types.ObjectId(body.subject),
            startTime: start,
            endTime: end,
            price,
            status: 'pending',
        });

        const formattedDate = dayjs(start).locale('th').format('D MMMM YYYY');
        const formattedTime = `${dayjs(start).format('HH:mm')} - ${dayjs(end).format('HH:mm')}`;

        const request = await this.notificationModel.create({
            senderId: new Types.ObjectId(userId),
            senderType: 'User',
            recipientId: new Types.ObjectId(teacherId),
            recipientType: 'Teacher',
            message: `มีคำขอจองคลาสใหม่ วันที่ ${body.date} เวลา ${body.startTime} - ${body.endTime}`,
            type: 'booking_request',
            meta: {
                bookingId: booking._id,
                subjectName: subject.name,
                date: body.date,
                startTime: body.startTime,
                endTime: body.endTime,
                price,
            },
        });

        return { booking, request }
    }


    async updateBookingStatus(
        teacherId: string,
        bookingId: string,
        status: 'approved' | 'rejected',
    ) {
        const teacher = await this.teacherModel.findOne({
            userId: new Types.ObjectId(teacherId)
        });
        if (!teacher) throw new BadRequestException('ไม่พบข้อมูลครู');

        const booking = await this.bookingModel.findById(bookingId);
        if (!booking) throw new NotFoundException('ไม่พบบุ๊คกิ้ง');

        if (!booking.teacherId.equals(teacher._id)) {
            throw new BadRequestException('ไม่มีสิทธิ์จัดการการจองนี้');
        }

        if (status === 'approved') {
            booking.status = 'wait_for_payment';
        } else {
            booking.status = 'rejected';
        }

        await booking.save();

        if (status === 'approved') {
            const existingSlot = await this.slotModel.findOne({
                teacherId: new Types.ObjectId(teacher._id),
                startTime: booking.startTime,
                endTime: booking.endTime,
            });

            if (existingSlot) {
                throw new BadRequestException('มี slot ซ้ำในช่วงเวลานี้แล้ว');
            }

            await this.slotModel.create({
                teacherId: teacher._id,
                bookingId: booking._id,
                startTime: booking.startTime,
                endTime: booking.endTime,
                price: booking.price,
                subject: booking.subject,
                meetId: null,
                status: 'wait_for_payment',
                bookedBy: booking.studentId
            });
        }
        

        const studentId = booking.studentId;
        await this.notificationModel.create({
            senderId: new Types.ObjectId(teacher._id),
            senderType: 'Teacher',
            recipientId: new Types.ObjectId(studentId),
            recipientType: 'User',
            type: status === 'approved' ? 'booking_wait_payment' : 'booking_reject',
            message:
                status === 'approved'
                    ? `ครูได้อนุมัติการจองคลาสวันที่ ${booking.startTime}`
                    : `ครูได้ปฏิเสธการจองคลาสวันที่ ${booking.startTime}`,
            meta: {
                bookingId: booking._id,
                startTime: booking.startTime,
                endTime: booking.endTime,
                price: booking.price,
                teacherName: `${teacher.name} ${teacher.lastName ?? ''}`.trim(),
            },
        });

        return booking;
    }





}
