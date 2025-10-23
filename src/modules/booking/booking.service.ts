import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Booking } from './schemas/booking.schema';
import { Model, Types } from 'mongoose';
import { Slot } from '../slots/schemas/slot.schema';
import { Notification } from '../notifications/schema/notification';
import { CreateBookingDto } from './schemas/booking.zod.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { SubjectList } from '../subjects/schema/subject.schema';

@Injectable()
export class BookingService {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(SubjectList.name) private subjectModel: Model<SubjectList>,
        @InjectModel(Notification.name) private notificationModel: Model<Notification>
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
            .find({ studentId: new Types.ObjectId(userId) })
            .populate('subject');

        return bookings;
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

        const start = new Date(`${body.date}T${body.startTime}:00`);
        const end = new Date(`${body.date}T${body.endTime}:00`);

        if (end <= start) throw new BadRequestException('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');

        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const price = teacher.hourlyRate * hours;

        const booking = await this.bookingModel.create({
            studentId: new Types.ObjectId(userId),
            teacherId: new Types.ObjectId(teacherId),
            subject: new Types.ObjectId(body.subject),
            date: body.date,
            startTime: start,
            endTime: end,
            price,
            status: 'pending',
        });

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
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
            });

            if (existingSlot) {
                throw new BadRequestException('มี slot ซ้ำในช่วงเวลานี้แล้ว');
            }

            await this.slotModel.create({
                teacherId: teacher._id,
                bookingId: booking._id,
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                price: booking.price,
                status: 'wait_for_payment',
                bookedBy: booking.studentId,
                meetId: null,
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
                    ? `ครูได้อนุมัติการจองคลาสวันที่ ${booking.date}`
                    : `ครูได้ปฏิเสธการจองคลาสวันที่ ${booking.date}`,
            meta: {
                bookingId: booking._id,
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                price: booking.price,
                teacherName: `${teacher.name} ${teacher.lastName ?? ''}`.trim(),
            },
        });

        return booking;
    }






}
