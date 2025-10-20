import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { Teacher } from "src/modules/teachers/schemas/teacher.schema";
import { User } from "src/modules/users/schemas/user.schema";


@Schema({ timestamps: true })
export class Notification {

    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    recipientId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name })
    senderId?: Types.ObjectId;

    @Prop({ required: true })
    message: string;

    @Prop({
        type: String,
        enum: [
            'booking-request',
            'booking-approve',
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
