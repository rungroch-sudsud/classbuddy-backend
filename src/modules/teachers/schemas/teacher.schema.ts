import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { SubjectList } from "src/modules/subjects/schema/subject.schema";
import { User } from "src/modules/users/schemas/user.schema";



@Schema({ timestamps: true })
export class Teacher {
    @Prop({
        type: Types.ObjectId,
        ref: User.name,
        required: true,
        unique: true
    })
    userId: Types.ObjectId;

    @Prop({
        minlength: 2,
        maxlength: 20,
        required: true
    })
    name: string;

    @Prop({
        minlength: 2,
        maxlength: 20,
        required: true
    })
    lastName: string;

    @Prop({ minlength: 150 })
    bio?: string;

    @Prop({
        type: [{
            type: Types.ObjectId,
            ref: SubjectList.name
        }]
    })
    subjects?: Types.ObjectId[];

    @Prop({
        min: 200,
        max: 3000,
        required: true
    })
    hourlyRate: number;

    @Prop({ min: 0, default: 0 })
    averageRating?: number;

    @Prop({ min: 0, default: 0 })
    reviewCount?: number;

    @Prop({ min: 0, default: 0 })
    teachCount?: number;

    @Prop({ min: 0, default: 0 })
    classCount?: number;

    @Prop({ min: 0, max: 80, required: true })
    experience?: number;

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
    idCard?: string | null;

    @Prop({ type: String, default: null })
    idCardWithPerson?: string | null;

    @Prop([
        {
            reviewerId: {
                type: Types.ObjectId,
                ref: 'User',
                required: true
            },
            rating: {
                type: Number,
                min: 1,
                max: 5,
                required: true
            },
            comment: { type: String },
        },
    ])
    reviews: {
        reviewerId: Types.ObjectId;
        rating: number;
        comment?: string;
    }[];

    @Prop({ maxlength: 20 })
    bankName?: string;

    @Prop({ maxlength: 60 })
    bankAccountName?: string;

    @Prop({ maxlength: 20 })
    bankAccountNumber?: string;

    @Prop({
        enum: ['draft', 'pending', 'process', 'verified'],
        default: 'draft'
    })
    verifyStatus: string;

    @Prop({ default: '' })
    recipientId?: string;

    @Prop()
    lastPayoutAt?: Date;
}

export type TeacherDocument = HydratedDocument<Teacher>;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);
