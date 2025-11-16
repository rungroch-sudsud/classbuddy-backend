import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocketModule } from '../socket/socket.module';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationSchema } from './schema/notification';

@Module({
    imports: [
        MongooseModule.forFeature([
            // { name: Booking.name, schema: BookingSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: Notification.name, schema: NotificationSchema },
        ]),
        SocketModule,
    ],
    providers: [NotificationsService],
    controllers: [NotificationsController],
    exports: [NotificationsService],
})
export class NotificationsModule {}
