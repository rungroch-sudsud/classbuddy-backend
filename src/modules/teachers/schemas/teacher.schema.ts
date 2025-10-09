import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument, Types } from "mongoose";
import { Slot } from "src/modules/slots/schemas/slot.schema";
import { SubjectList } from "src/modules/subjects/schema/subject.schema";
import { User } from "src/modules/users/schemas/user.schema";



@Schema({ timestamps: true })
export class Teacher {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
    userId: Types.ObjectId;

    @Prop()
    name: string;

    @Prop()
    lastName: string;

    @Prop({ type: Types.ObjectId, ref: SubjectList.name, })
    subject: Types.ObjectId;

    @Prop()
    bio: string;

    @Prop()
    description: string;

    @Prop([String])
    skills: string[];

    @Prop()
    hourlyRate: number;

    @Prop()
    experience: number;

    @Prop()
    classCount: number;
    @Prop()
    student: number;
    @Prop()
    review: number;

    @Prop()
    teachCount: number;

    @Prop([String])
    language: string[];

    @Prop()
    videoLink: string;

    @Prop([String])
    certificate: string[];

    @Prop()
    idCard: string;

    @Prop()
    bankName: string;

    @Prop()
    bankAccountName: string;

    @Prop()
    bankAccountNumber: string;

    @Prop({ default: false })
    isVerified: boolean;
}

export type TeacherDocument = HydratedDocument<Teacher>;
export const TeacherSchema = SchemaFactory.createForClass(Teacher);