import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { SubjectList } from "src/modules/subjects/schema/subject.schema";
import { Teacher } from "src/modules/teachers/schemas/teacher.schema";
import { User } from "src/modules/users/schemas/user.schema";


@Schema({ timestamps: true })
export class Booking {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Teacher.name, required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: String, required: true })
    date: string;

    @Prop({ type: Date, required: true })
    startTime: Date;

    @Prop({ type: Date, required: true })
    endTime: Date;

    @Prop({ type: Number, required: true })
    price: number;

    @Prop({ type: Types.ObjectId, ref: SubjectList.name, required: true })
    subject: Types.ObjectId;

    // @Prop({ type: String })
    // meetId?: string;

    // @Prop({ type: String })
    // notes?: string;

    @Prop({ type: Object, default: {} })
    meta?: Record<string, any>;
    
    @Prop({
        type: String,
        enum: ['pending', 'wait_for_payment', 'paid', 'rejected'],
        default: 'pending'
    })
    status: string;

    @Prop({ type: Date })
    paidAt?: Date;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
