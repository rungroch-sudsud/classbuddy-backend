import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from 'mongoose'
import { Teacher } from "src/modules/teachers/schemas/teacher.schema";
import { User } from "src/modules/users/schemas/user.schema";


@Schema({ timestamps: true })
export class Chat {
    @Prop({ type: Types.ObjectId, ref: Teacher.name, required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    studentId: Types.ObjectId;

    @Prop({ type: String, required: true, unique: true })
    channelId: string;
}

export type ChatDocument = Chat & Document;
export const ChatSchema = SchemaFactory.createForClass(Chat);