import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Booking } from './schemas/booking.schema';
import { Model, Types } from 'mongoose';
import { Slot } from '../slots/schemas/slot.schema';

@Injectable()
export class BookingService {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
    ) { }


    async bookSlot(
        slotId: string,
        studentId: string,
    ): Promise<any> {
        const slot = await this.slotModel.findById(slotId);
        if (!slot) throw new NotFoundException('ไม่พบ slot ที่ต้องการจอง');

        if (slot.status !== 'available') {
            throw new BadRequestException('Slot นี้ถูกจองหรือไม่ว่างแล้ว');
        }

        const existingBooking = await this.bookingModel.findOne({
            studentId,
            slotId,
        });

        if (existingBooking) throw new BadRequestException('คุณได้จอง slot นี้ไปแล้ว');

        const booking = await this.bookingModel.create({
            studentId: new Types.ObjectId(studentId),
            teacherId: slot.teacherId,
            slotId: slot._id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            date: slot.date,
            price: slot.price,
            status: 'pending',
        });

        slot.status = 'booked';
        slot.bookedBy = new Types.ObjectId(studentId);
        await slot.save();

        return booking;
    }

    
    async getMySlot(userId: string) {
        const bookings = await this.bookingModel
            .find({ studentId: new Types.ObjectId(userId) })
            // .populate('slotId');

        return bookings;
    }
}
