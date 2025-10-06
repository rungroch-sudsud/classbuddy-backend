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
        studentId: string, 
        slotId: string, 
        body: any
    ):Promise<any> {
        const slot = await this.slotModel.findById(slotId);
        if (!slot) throw new NotFoundException('ไม่พบ slot ที่ต้องการจอง');
        
        if (slot.status !== 'available') {
            throw new BadRequestException('Slot นี้ถูกจองหรือไม่ว่างแล้ว');
        }

        const booking = await this.bookingModel.create({
            studentId,
            teacherId: slot.teacherId,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: 'pending', 
            ...body,
        });

        slot.status = 'booked';
        slot.bookedBy = new Types.ObjectId(studentId);
        await slot.save();

        return booking;
    }


}
