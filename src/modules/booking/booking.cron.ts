import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from './schemas/booking.schema';
import { Slot } from '../slots/schemas/slot.schema';
import dayjs from 'dayjs';

@Injectable()
export class BookingCronService {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
    ) {}

    @Cron('*/3 * * * *')
    async expireOldBookings() {
        const tenMinutesAgo = dayjs().subtract(10, 'minute').toDate();

        const expiredBookings = await this.bookingModel.find({
            status: 'pending',
            createdAt: { $lt: tenMinutesAgo },
        });

        if (!expiredBookings.length) return;

        for (const booking of expiredBookings) {
            booking.status = 'expired';
            await booking.save();

            await this.slotModel.deleteOne({
                bookingId: booking._id,
                status: 'pending',
            });
        }

        console.log(`ปล่อย slot คืน ${expiredBookings.length} รายการ`);
    }
}
