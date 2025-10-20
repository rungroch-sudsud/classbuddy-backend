import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { SlotsModule } from '../slots/slots.module';
import { Notification, NotificationSchema } from '../notifications/schema/notification';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Booking.name, schema: BookingSchema },
            { name: Notification.name, schema: NotificationSchema }
        ]),
        SlotsModule
    ],
    providers: [BookingService],
    controllers: [BookingController],
    exports: [BookingService],
})
export class BookingModule { }