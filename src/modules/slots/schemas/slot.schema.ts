import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Slot extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
  teacherId: string;

  @Prop({ type: String, required: true })
  date: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ default: null })
  meetId: string;

  @Prop({
    type: String,
    enum: ['available', 'booked', 'cancelled', 'expired'],
    default: 'available',
  })
  status: 'available' | 'booked' | 'cancelled' | 'expired';

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  bookedBy: Types.ObjectId
}

export type SlotDocument = Slot & Document;
export const SlotSchema = SchemaFactory.createForClass(Slot);