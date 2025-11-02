import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Slot } from "src/modules/slots/schemas/slot.schema";
import { SubjectList } from "src/modules/subjects/schemas/subject.schema";
import { Teacher } from "src/modules/teachers/schemas/teacher.schema";
import { User } from "src/modules/users/schemas/user.schema";
import { BookingStatusList } from "src/shared/enums/booking.status.enum";
import type { BookingStatus } from 'src/shared/enums/booking.status.enum';


@Schema({ timestamps: true })
export class Booking {
    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true
    })
    studentId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: Teacher.name,
        required: true
    })
    teacherId: Types.ObjectId;

    @Prop({ type: String, required: true})
    slotId: string;

    @Prop({ type: String })
    date: string;

    @Prop({ type: Date, required: true })
    startTime: Date;

    @Prop({ type: Date, required: true })
    endTime: Date;

    @Prop({ type: Number, required: true })
    price: number;

    @Prop({
        type: Types.ObjectId,
        ref: SubjectList.name,
    })
    subject: Types.ObjectId;

    // @Prop({ type: Object, default: {} })
    // meta?: Record<string, any>;

    @Prop({
        type: String,
        enum: BookingStatusList,
        default: 'pending'
    })
    status: BookingStatus;

    @Prop({ type: Date })
    paidAt?: Date;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
