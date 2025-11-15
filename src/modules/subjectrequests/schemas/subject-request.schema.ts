import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SubjectRequest {
  @Prop({ unique: true, required: true })
  name: string;
}

export type SubjectRequestDocument = SubjectRequest & Document;
export const SubjectRequestSchema = SchemaFactory.createForClass(SubjectRequest);
