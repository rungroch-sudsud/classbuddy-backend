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

    @Prop()
    name: string;

    @Prop()
    lastName: string;

    @Prop()
    bio: string;

    @Prop({
        type: [{
            type: Types.ObjectId,
            ref: SubjectList.name
        }]
    })
    subjects?: Types.ObjectId[];

    @Prop() hourlyRate: number;

    @Prop({ default: 0 })
    averageRating: number;

    @Prop({ default: 0 })
    reviewCount: number;

    @Prop()
    teachCount?: number;

    @Prop()
    classCount?: number;

    @Prop()
    experience?: number;

    @Prop([
        {
            level: { type: String, required: true },
            institution: { type: String, required: true },
        },
    ])
    educationHistory: {
        level: string;
        institution: string;
    }[];

    @Prop([String])
    language: string[];

    @Prop()
    videoLink?: string;

    @Prop({ type: [String], default: [] })
    certificate: string[];

    @Prop({ type: String, default: null })
    idCard: string | null;

    @Prop({ type: String, default: null })
    idCardWithPerson: string | null;

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


    @Prop()
    bankName: string;

    @Prop()
    bankAccountName: string;

    @Prop()
    bankAccountNumber: string;

    @Prop({
        default: 'draft',
        enum: ['draft', 'pending', 'verified', 'rejected']
    })
    verifyStatus: string;

    @Prop()
    recipientId?: string;

    @Prop()
    lastPayoutAt?: Date;
}


export type TeacherDocument = HydratedDocument<Teacher>;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);
