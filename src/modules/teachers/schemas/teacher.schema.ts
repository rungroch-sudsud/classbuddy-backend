import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { Slot } from "src/modules/slots/schemas/slot.schema";
import { SubjectList } from "src/modules/subjects/schema/subject.schema";
import { User } from "src/modules/users/schemas/user.schema";



@Schema({ timestamps: true })
export class Teacher {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
    userId: Types.ObjectId;

    @Prop() name: string;
    @Prop() lastName: string;
    @Prop() bio: string;

    @Prop({ type: Types.ObjectId, ref: SubjectList.name })
    subject: Types.ObjectId;

    @Prop() hourlyRate: number;

    @Prop([String]) language: string[];

    @Prop() classCount: number;
    @Prop() student: number;
    @Prop() review: number;
    @Prop() teachCount: number;

    @Prop([
        {
            level: { type: String, required: true },
            institution: { type: String, required: true },
            faculty: { type: String, required: true },
            major: { type: String, required: true },
        },
    ])
    educationHistory: {
        level: string;
        institution: string;
        faculty: string;
        major: string;
    }[];

    @Prop() videoLink: string;

    @Prop({ type: [String], default: [] })
    certificate: string[];

    @Prop({ type: String, default: null })
    idCard: string | null;

    @Prop({ type: String, default: null })
    idCardWithPerson: string | null;


    @Prop() bankName: string;
    @Prop() bankAccountName: string;
    @Prop() bankAccountNumber: string;

    @Prop()
    profileImage?: string;


    @Prop({ default: false })
    isVerified: boolean;
    @Prop() recipientId?: string;
    @Prop() lastPayoutAt?: Date;
}


export type TeacherDocument = HydratedDocument<Teacher>;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);