import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class BlackList extends Document<Types.ObjectId> {
    @Prop(String)
    scammerUsername: string;

    @Prop(String)
    platform: string;

    @Prop([String])
    evidenceUrls: Array<string>;
}

export type BlackListDocument = HydratedDocument<BlackList>;
export const BlackListSchema = SchemaFactory.createForClass(BlackList);
