import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schema/notification';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            // { name: Booking.name, schema: BookingSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: Notification.name, schema: NotificationSchema }
        ]),
    ],
    providers: [NotificationsService],
    controllers: [NotificationsController],
    exports: [NotificationsService],
})
export class NotificationsModule { }
