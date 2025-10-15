import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, required: true })
  phone: string;

  @Prop({ unique: true, sparse: true })
  email?: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  name?: string;

  @Prop()
  lastName?: string;

  @Prop()
  nickName?: string;

  @Prop()
  age?: number;

  @Prop([String])
  subject?: string[];

  @Prop()
  class?: string;

  // @Prop()
  // point?: string;

  @Prop({ default: 'user' })
  role: 'user' | 'teacher';

  @Prop({ type: [String], default: [] })
  bookmarks: string[];

  @Prop()
  profileImage?: string;

}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);