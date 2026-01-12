import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ClassTrial {
    @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
    bookingId: Types.ObjectId;
}

export type ClassTrialDocument = ClassTrial & Document;
export const ClassTrialSchema = SchemaFactory.createForClass(ClassTrial);
