import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';


@Schema()
export class SubjectList {
  @Prop({ unique: true, required: true })
  name: string;

  @Prop()
  file?: string;

}

export type SubjectListDocument = SubjectList & Document;
export const SubjectSchema = SchemaFactory.createForClass(SubjectList);