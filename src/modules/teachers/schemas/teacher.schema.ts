import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';
import { User } from 'src/modules/users/schemas/user.schema';
import { BUSINESS_CONFIG } from 'src/shared/configs/business.config';
import { SubjectDetail } from '../dto/teacher.dto.zod';

@Schema({ timestamps: true })
export class Teacher {
    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true,
        unique: true,
    })
    userId: Types.ObjectId;

    @Prop({
        minlength: 2,
        maxlength: 20,
        required: true,
    })
    name: string;

    @Prop({
        minlength: 2,
        maxlength: 20,
        required: true,
    })
    lastName: string;

    @Prop({ minlength: 150 })
    bio?: string;

    @Prop({
        type: [
            {
                type: Types.ObjectId,
                ref: SubjectList.name,
            },
        ],
    })
    subjects?: Types.ObjectId[];

    @Prop({ default: null })
    customSubjects?: string;

    @Prop({ min: 0, max: 80, required: true })
    experience?: number;

    @Prop({ min: 0, default: 0 })
    averageRating?: number;

    @Prop([
        {
            subjectId: { type: Types.ObjectId },
            detail: { type: String, minLength: 250 },
            hourlyRate: {
                type: Number,
                minLength: BUSINESS_CONFIG.MINIMUM_HOURLY_RATE,
                maxLegnth: BUSINESS_CONFIG.MAXIMUM_HOURLY_RATE,
            },
        },
    ])
    subjectDetails: Array<SubjectDetail>;

    @Prop({ min: 0, default: 0 })
    reviewCount?: number;

    @Prop({ min: 0, max: 100, default: 0 })
    satisfactionRate: number;

    @Prop({ min: 0, default: 0 })
    totalTeachingHours?: number;

    @Prop({ min: 0, default: 0 })
    totalTeachingClass?: number;

    @Prop({ min: 0, default: 0 })
    totalStudentInClass?: number;

    @Prop([
        {
            level: { type: String, maxlength: 50, required: true },
            institution: { type: String, maxlength: 50, required: true },
        },
    ])
    educationHistory?: {
        level: string;
        institution: string;
    }[];

    @Prop([String])
    language?: string[];

    @Prop({ maxlength: 500 })
    videoLink?: string;

    @Prop({ type: [String], default: [] })
    certificate?: string[];

    @Prop({ type: String, default: null })
    idCardWithPerson?: string | null;

    @Prop({
        type: [
            {
                reviewerId: {
                    type: Types.ObjectId,
                    ref: User.name,
                    required: true,
                },
                rating: { type: Number, min: 1, max: 5, required: true },
                comment: { type: String, maxlength: 500 },
                createdAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    })
    reviews: {
        reviewerId: Types.ObjectId;
        rating: number;
        comment?: string;
        createdAt: Date;
    }[];

    @Prop({ maxlength: 20 })
    bankName?: string;

    @Prop({ maxlength: 60 })
    bankAccountName?: string;

    @Prop({ maxlength: 20 })
    bankAccountNumber?: string;

    @Prop({
        enum: ['draft', 'pending', 'process', 'verified'],
        default: 'draft',
    })
    verifyStatus: string;

    @Prop({ default: '' })
    recipientId?: string;

    @Prop()
    lastPayoutAt?: Date;
}

export type TeacherDocument = HydratedDocument<Teacher>;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);

TeacherSchema.virtual('user', {
    ref: 'User',
    localField: 'userId',
    foreignField: '_id',
    justOne: true,
});
