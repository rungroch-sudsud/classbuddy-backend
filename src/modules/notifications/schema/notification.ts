import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { Teacher } from "src/modules/teachers/schemas/teacher.schema";
import { User } from "src/modules/users/schemas/user.schema";


@Schema({ timestamps: true })
export class Notification {

    @Prop({
        type: Types.ObjectId,
        required: true,
        refPath: 'recipientType',
    })
    recipientId: Types.ObjectId;

    @Prop({ type: String, enum: ['User', 'Teacher'], required: true })
    recipientType: string;

    @Prop({
        type: Types.ObjectId,
        refPath: 'senderType',
        default: null,
    })
    senderId?: Types.ObjectId | null;

    @Prop({ type: String, enum: ['User', 'Teacher', 'System'], default: 'System' })
    senderType: string;

    @Prop({ required: true })
    message: string;

    @Prop({
        type: String,
        enum: [
            'booking_request',
            'booking_wait_payment',
            'booking_reject',
            'booking_paid',
            'system'
        ],
        default: 'system'
    })
    type: string;

    @Prop({ type: Object, default: {} })
    meta?: Record<string, any>;

    @Prop({ default: false })
    isRead: boolean;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
