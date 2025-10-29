import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';

@Schema()
export class Slot extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
  teacherId: string;

  @Prop()
  bookingId: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ required: true })
  price: number;

  @Prop({ type: Types.ObjectId, ref: SubjectList.name, required: true })
  subject: Types.ObjectId;

  @Prop({ default: null })
  meetId: string;

  @Prop({
    type: String,
    enum: ['pending', 'wait_for_payment', 'paid', 'studied', 'rejected'],
    default: 'pending'
  })
  status: 'pending' | 'wait_for_payment' | 'paid' | 'studied' | 'rejected';

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  bookedBy: Types.ObjectId
}

export type SlotDocument = Slot & Document;
export const SlotSchema = SchemaFactory.createForClass(Slot);