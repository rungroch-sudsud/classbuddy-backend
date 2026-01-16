import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Announcement extends Document<Types.ObjectId> {
    @Prop({ type: String, default: null })
    imageUrl: string | null;

    @Prop({ type: String, default: null })
    externalUrl: string | null;

    @Prop({ type: Number, default: 0 })
    order: number;
}

export type AnnouncementDocument = HydratedDocument<Announcement>;
export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);
