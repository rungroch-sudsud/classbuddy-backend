import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Course extends Document<Types.ObjectId> {
    @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: String, default: null })
    courseImageUrl: string | null;

    @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
    subjectId: Types.ObjectId;

    @Prop({ type: String, required: true })
    courseName: string;

    @Prop({ type: String, required: true })
    courseGoal: string;

    @Prop({ type: Number, required: true })
    courseTotalHours: number;

    @Prop({ type: Number, required: true })
    price: number;

    @Prop({ type: String, required: true })
    courseDetail: string;

    @Prop({ type: Boolean, required: true, default: false })
    issueCertificate: boolean;
}

export type CourseDocument = Course & Document;
export const CourseSchema = SchemaFactory.createForClass(Course);
