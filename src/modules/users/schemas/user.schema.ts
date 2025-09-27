import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";


@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, required: true })
  phone: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  name?: string;

}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);