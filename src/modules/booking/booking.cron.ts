import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from './schemas/booking.schema';
import { Slot } from '../slots/schemas/slot.schema';
import dayjs from 'dayjs';
import { SocketService } from '../socket/socket.service';
import { SocketEvent } from 'src/shared/enums/socket.enum';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { businessConfig } from 'src/configs/business.config';

@Injectable()
export class BookingCronService {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        private readonly socketService: SocketService,
    ) {}

    @Cron('*/3 * * * *')
    async expireOldBookings() {
        const bookingExpiryTime = dayjs().subtract(businessConfig.payments.maximumBookingExpiryTime, 'minute').toDate();

        const expiredBookings = await this.bookingModel.find({
            status: 'pending',
            createdAt: { $lt: bookingExpiryTime },
        });

        if (!expiredBookings.length) return;

        for (const booking of expiredBookings) {
            booking.status = 'expired';
            await booking.save();

            await this.slotModel.deleteOne({
                bookingId: booking._id,
                status: 'pending',
            });

            const teacher = await this.teacherModel
                .findById(booking.teacherId)
                .lean();

            this.socketService.emit(SocketEvent.BOOKING_EXPIRED, {
                teacherUserId: teacher?.userId.toString(),
                studentId: booking.studentId.toString(),
            });
        }

        console.log(`ปล่อย slot คืน ${expiredBookings.length} รายการ`);
    }
}
