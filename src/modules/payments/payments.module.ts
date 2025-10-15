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
import { REDIS_CLIENT } from 'src/infra/redis/redis.provider';
import { PayoutLog, PayoutLogSchema } from './schemas/payout.schema';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { PayoutProcessor } from './processors/payout.processor';
import { PayoutScheduler } from './processors/payout.scheduler';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Wallet.name, schema: WalletSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Booking.name, schema: BookingSchema },
            { name: User.name, schema: UserSchema },
            { name: Slot.name, schema: SlotSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: PayoutLog.name, schema: PayoutLogSchema }
        ]),
        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST,
                port: Number(process.env.REDIS_PORT)
            },
        }),
        BullModule.registerQueue({
            name: 'payout',
        }),
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
