import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Types } from "mongoose";
import { User } from "./user.schema";


class Subject {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    hourlyRate: number;
}

@Schema({ timestamps: true })
export class Teacher {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    userId: Types.ObjectId;

    @Prop()
    name: string;

    @Prop()
    lastName: string;

    @Prop()
    bio: string;

    @Prop()
    description: string;

    @Prop({ type: [{ name: String, hourlyRate: Number }] })
    subjects: { name: string; hourlyRate: number }[];

    @Prop()
    review: number;

    @Prop()
    experince: number;

    @Prop()
    studen: number;

    @Prop()
    language: string;

    @Prop()
    videoLink: string;

    @Prop()
    verify: string;

    @Prop({ default: false })
    isVerified: boolean;
}

export type TeacherDocument = Teacher & Document;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);