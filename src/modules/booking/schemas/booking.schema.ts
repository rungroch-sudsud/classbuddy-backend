import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';
import { ClassTrial } from 'src/modules/classtrials/schemas/classtrial.schema';
import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { User } from 'src/modules/users/schemas/user.schema';
import type { BookingStatus, BookingType } from 'src/shared/enums/booking.enum';
import {
    BookingStatusList,
    BookingTypeList,
} from 'src/shared/enums/booking.enum';

@Schema({ timestamps: true })
export class Booking extends Document<Types.ObjectId> {
    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true,
    })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: ClassTrial.name, default: null })
    classTrialId: Types.ObjectId | null;

    @Prop({
        type: Types.ObjectId,
        ref: Teacher.name,
        required: true,
    })
    teacherId: Types.ObjectId;

    @Prop({ type: String, default: null })
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
        default: null,
    })
    subject: Types.ObjectId;

    @Prop({
        type: String,
        enum: BookingStatusList,
        default: 'pending',
    })
    status: BookingStatus;

    @Prop({ type: String, default: null })
    callRoomId: string | null;

    @Prop({ type: Date, default: null })
    paidAt?: Date;

    @Prop({
        type: String,
        enum: BookingTypeList,
        default: 'require_payment',
    })
    type: BookingType;

    @Prop({ type: Date, default: null })
    maximumPaymentExpiredAt?: Date;

    @Prop({ type: String, default: null })
    studentShortNote: string | null;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
