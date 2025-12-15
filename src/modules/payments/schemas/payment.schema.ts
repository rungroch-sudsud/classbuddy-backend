import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentType {
    TOPUP = 'TOPUP',
    BOOKING_PAYMENT = 'BOOKING_PAYMENT',
    REFUND = 'REFUND',
    // TRANSFER_TO_TEACHER = 'TRANSFER_TO_TEACHER',
    // PAYOUT = 'PAYOUT',
}

export enum PaymentMethod {
    WALLET = 'wallet',
    PROMPTPAY = 'promptpay',
    BANK_TRANSFER = 'bank-transfer',
}

export enum PaymentStatus {
    SUCCESS = 'successful',
    FAILED = 'failed',
    PENDING = 'pending',
    AWAITING = 'awaiting_payment',
}

@Schema({ timestamps: true })
export class Payment {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Teacher' })
    teacherId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Booking' })
    bookingId?: Types.ObjectId;

    @Prop()
    chargeId?: string;

    @Prop()
    sourceId?: string;

    @Prop({ required: true })
    amount: number;

    @Prop({ default: PaymentMethod.PROMPTPAY })
    method: string;

    @Prop({ type: String, default: null })
    easySlipTransRef?: string;

    @Prop({
        required: true,
        enum: PaymentStatus,
        default: PaymentStatus.PENDING,
    })
    status: PaymentStatus;

    @Prop({ type: Object })
    raw?: Record<string, any>;
}

export type PaymentDocument = Payment & Document;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
