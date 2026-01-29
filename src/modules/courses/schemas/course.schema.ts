import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CourseStatus } from '../enums/course.enum';

@Schema({ timestamps: true })
export class Course extends Document<Types.ObjectId> {
    @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: String, default: null })
    courseImageUrl: string | null;

    @Prop({ type: Types.ObjectId, ref: 'SubjectList', required: true })
    subjectId: Types.ObjectId;

    @Prop({ type: String, required: true })
    courseName: string;

    @Prop({ type: [String], required: false, default: [] })
    courseGoals: string[];

    @Prop({ type: Number, required: false, default: null })
    courseTotalHours: number | null;

    @Prop({ type: Number, required: false, default: null })
    price: number | null;

    @Prop({ type: String, required: false, default: null })
    courseDetail: string | null;

    @Prop({ type: Boolean, required: true, default: false })
    issueCertificate: boolean;

    @Prop({
        type: String,
        enum: CourseStatus,
        required: true,
        default: CourseStatus.PUBLISHED,
    })
    status: CourseStatus;
}

export type CourseDocument = Course & Document;
export const CourseSchema = SchemaFactory.createForClass(Course);
