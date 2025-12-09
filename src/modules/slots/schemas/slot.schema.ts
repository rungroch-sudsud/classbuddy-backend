import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';
import { BookingStatusList } from 'src/shared/enums/booking.enum';
import type { BookingStatus } from 'src/shared/enums/booking.enum';

@Schema()
export class Slot extends Document {
    @Prop({
        type: Types.ObjectId,
        ref: 'Teacher',
        required: true,
    })
    teacherId: string;

    @Prop({ type: Types.ObjectId, ref: 'Booking', default: null })
    bookingId: Types.ObjectId;

    @Prop({ type: String, required: true })
    date: string;

    @Prop({ type: Date, required: true })
    startTime: Date;

    @Prop({ type: Date, required: true })
    endTime: Date;

    @Prop({ type: Number, default: null })
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
        default: 'available',
    })
    status: BookingStatus;

    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        default: null,
    })
    bookedBy: Types.ObjectId;

    @Prop({ type: String, default: null })
    callRoomId: string;

    @Prop({ type: Date, default: null })
    paidAt?: Date;
}

export type SlotDocument = Slot & Document;

export const SlotSchema = SchemaFactory.createForClass(Slot);

SlotSchema.virtual('booking', {
    ref: 'Booking',
    localField: 'bookingId',
    foreignField: '_id',
    justOne: true,
});
