import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { User } from 'src/modules/users/schemas/user.schema';
import { Booking } from 'src/modules/booking/schemas/booking.schema';

@Schema({ timestamps: true })
export class ClassTrial {
    @Prop({ type: Types.ObjectId, ref: Teacher.name, required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: Booking.name, required: true })
    bookingId: Types.ObjectId;
}

export type ClassTrialDocument = ClassTrial & Document;
export const ClassTrialSchema = SchemaFactory.createForClass(ClassTrial);
