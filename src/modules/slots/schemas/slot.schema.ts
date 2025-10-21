import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Slot extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
  teacherId: string;

  @Prop()
  bookingId: string;

  @Prop({ type: String, required: true })
  date: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ required: true })
  price: number;

  @Prop({ default: null })
  meetId: string;

  @Prop({
    type: String,
    enum: [ 'wait_for_payment', 'paid', 'rejected', 'expired'],
    default: 'wait_for_payment',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  bookedBy: Types.ObjectId
}

export type SlotDocument = Slot & Document;
export const SlotSchema = SchemaFactory.createForClass(Slot);