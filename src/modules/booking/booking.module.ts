import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from '../chat/chat.module';
import { StreamChatService } from '../chat/stream-chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
    Notification,
    NotificationSchema,
} from '../notifications/schema/notification';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { SlotsModule } from '../slots/slots.module';
import { SlotsService } from '../slots/slots.service';
import { SubjectList, SubjectSchema } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { BookingController } from './booking.controller';
import { BookingCronService } from './booking.cron';
import { BookingService } from './booking.service';
import { BookingProcessor } from './processors/booking.processor';
import { Booking, BookingSchema } from './schemas/booking.schema';
import { SocketService } from '../socket/socket.service';
import { SocketGateway } from '../socket/socket.gateway';
import { JwtService } from '@nestjs/jwt';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Booking.name, schema: BookingSchema },
            { name: Slot.name, schema: SlotSchema },
            { name: User.name, schema: UserSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: SubjectList.name, schema: SubjectSchema },
            { name: Notification.name, schema: NotificationSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Wallet.name, schema: WalletSchema },
        ]),
        BullModule.registerQueue({
            name: 'booking',
        }),
        ConfigModule,
        SlotsModule,
        ChatModule,
    ],

    providers: [
        JwtService,
        SocketGateway,
        SocketService,
        BookingCronService,
        StreamChatService,
        SlotsService,
        BookingProcessor,
        NotificationsService,
        BookingService,
    ],
    controllers: [BookingController],
    exports: [BullModule, BookingService],
})
export class BookingModule {}
