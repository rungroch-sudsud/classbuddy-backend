import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Notification {
    @Prop({
        type: Types.ObjectId,
        required: true,
        refPath: 'recipientType',
    })
    recipientId: Types.ObjectId;

    @Prop({
        type: String,
        enum: ['User', 'Teacher'],
        required: true,
    })
    recipientType: string;

    @Prop({
        type: Types.ObjectId,
        refPath: 'senderType',
        default: null,
    })
    senderId?: Types.ObjectId | null;

    @Prop({
        type: String,
        enum: ['User', 'Teacher', 'System'],
        default: 'System',
    })
    senderType: string;

    @Prop({ required: true, maxlength: 500 })
    message: string;

    @Prop({
        type: String,
        enum: [
            'booking_wait_payment',
            'booking_reject',
            'booking_paid',
            'review_added',
            'system',
        ],
        default: 'system',
    })
    type: string;

    @Prop({ type: Object, default: {} })
    meta?: Record<string, any>;

    @Prop({ default: false })
    isRead: boolean;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
