import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { BullModule } from '@nestjs/bullmq';
import { PayoutLog, PayoutLogSchema } from './schemas/payout.schema';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PayoutProcessor } from './processors/payout.processor';
import { PayoutScheduler } from './processors/payout.scheduler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification, NotificationSchema } from '../notifications/schema/notification';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';


@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: Wallet.name, schema: WalletSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Booking.name, schema: BookingSchema },
            { name: User.name, schema: UserSchema },
            { name: Slot.name, schema: SlotSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: PayoutLog.name, schema: PayoutLogSchema },
            { name: Notification.name, schema: NotificationSchema }
        ]),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
                    port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
                },
            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({
            name: 'payout',
        }),
        ChatModule,
        NotificationsModule
    ],
    controllers: [PaymentsController, WebhookController],
    providers: [
        PaymentsService,
        WebhookService,
        PayoutProcessor,
        PayoutScheduler,
    ],
    exports: [PaymentsService, MongooseModule],
})
export class PaymentsModule { }
