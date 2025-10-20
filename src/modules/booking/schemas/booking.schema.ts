import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";


@Schema({ timestamps: true })
export class Booking {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: String, required: true })
    date: string;

    @Prop({ type: Date, required: true })
    startTime: Date;

    @Prop({ type: Date, required: true })
    endTime: Date;

    @Prop({ type: Number, required: true })
    price: number;

    @Prop({ type: String })
    meetId?: string;

    @Prop({ type: String })
    notes?: string;

    @Prop({
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    })
    status: string;

    @Prop({ type: Date })
    paidAt?: Date;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
