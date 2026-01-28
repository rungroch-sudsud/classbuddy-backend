import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class SubjectList extends Document<Types.ObjectId> {
    @Prop({ unique: true, required: true })
    name: string;

    @Prop()
    file?: string;

    @Prop({ default: 0 })
    priority: number;
}

export type SubjectListDocument = SubjectList & Document;
export const SubjectSchema = SchemaFactory.createForClass(SubjectList);

SubjectSchema.set('id', false);
SubjectSchema.set('toJSON', { virtuals: true, versionKey: false });
SubjectSchema.set('toObject', { virtuals: true });
