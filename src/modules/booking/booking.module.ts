import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { SmsModule } from 'src/infra/sms/sms.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsService } from '../notifications/notifications.service';
import {
    Notification,
    NotificationSchema,
} from '../notifications/schema/notification';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { SlotsModule } from '../slots/slots.module';
import { SocketGateway } from '../socket/socket.gateway';
import { SocketService } from '../socket/socket.service';
import { SubjectList, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { BookingController } from './booking.controller';
import { BookingCronService } from './booking.cron';
import { BookingService } from './booking.service';
import { BookingProcessor } from './processors/booking.processor';
import { Booking, BookingSchema } from './schemas/booking.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Booking.name, schema: BookingSchema },
            { name: Slot.name, schema: SlotSchema },
            { name: User.name, schema: UserSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: SubjectList.name, schema: SubjectSchema },
            { name: Notification.name, schema: NotificationSchema },
        ]),
        BullModule.registerQueue({
            name: 'booking',
        }),

        ConfigModule,
        SlotsModule,
        ChatModule,
        SmsModule,
    ],

    providers: [
        JwtService,
        SocketGateway,
        SocketService,
        BookingCronService,
        NotificationsService,
        BookingProcessor,
        BookingService,
    ],
    controllers: [BookingController],
    exports: [BullModule, BookingService],
})
export class BookingModule {}
