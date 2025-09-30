import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Types } from "mongoose";
import { User } from "./user.schema";



@Schema({ timestamps: true })
export class Teacher {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
    userId: Types.ObjectId;

    @Prop()
    name: string;

    @Prop()
    lastName: string;

    @Prop()
    bio: string;

    @Prop()
    description: string;

    @Prop([String])
    skills: string[];

    @Prop()
    hourlyRate: number;

    @Prop()
    experince: number;

    @Prop()
    classCount: number;
    @Prop()
    studen: number;
    @Prop()
    review: number;

    @Prop([String])
    language: string[];

    @Prop()
    videoLink: string;

    @Prop()
    verify: string;

    @Prop({ default: false })
    isVerified: boolean;
}

export type TeacherDocument = Teacher & Document;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);