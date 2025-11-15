import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from '../chat/chat.module';
import {
    Notification,
    NotificationSchema,
} from '../notifications/schema/notification';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { SlotsModule } from '../slots/slots.module';
import { SubjectList, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { BookingController } from './booking.controller';
import { BookingCronService } from './booking.cron';
import { BookingService } from './booking.service';
import { BookingProcessor } from './processors/booking.processor';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { StreamChatService } from '../chat/stream-chat.service';
import { SlotsService } from '../slots/slots.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'booking',
        }),
        ConfigModule,
        MongooseModule.forFeature([
            { name: Booking.name, schema: BookingSchema },
            { name: Slot.name, schema: SlotSchema },
            { name: User.name, schema: UserSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: SubjectList.name, schema: SubjectSchema },
            { name: Notification.name, schema: NotificationSchema },
        ]),
        SlotsModule,
        ChatModule,
    ],

    providers: [
        BookingService,
        BookingCronService,
        StreamChatService,
        SlotsService,
        BookingProcessor,
    ],
    controllers: [BookingController],
    exports: [BookingService, BullModule],
})
export class BookingModule {}
