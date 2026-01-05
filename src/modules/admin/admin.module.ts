import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmsModule } from 'src/infra/sms/sms.module';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { ChatService } from '../chat/chat.service';
import { NotificationsModule } from '../notifications/notifications.module';
import {
    Notification,
    NotificationSchema,
} from '../notifications/schema/notification';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ChatModule } from '../chat/chat.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Teacher.name, schema: TeacherSchema },
            { name: Notification.name, schema: NotificationSchema },
            { name: Booking.name, schema: BookingSchema },
            { name: User.name, schema: UserSchema },
        ]),
        NotificationsModule,
        SmsModule,
        ChatModule,
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
