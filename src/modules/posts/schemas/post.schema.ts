import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class PostProposal {
    @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true })
    teacherId: Types.ObjectId;

    @Prop({ type: String, required: true })
    detail: string;
}

const PostProposalSchema = SchemaFactory.createForClass(PostProposal);

@Schema({ timestamps: true })
export class Post extends Document<Types.ObjectId> {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: String, required: true })
    detail: string;

    @Prop({ type: Date, default: null })
    closedAt: Date; // : เวลาในการปิดโพส (หากปิดโพสแล้วมันจะหายไปจากหน้าจอเลย)

    @Prop({ type: [PostProposalSchema], default: [] })
    proposals: Array<PostProposal>;
}

export type PostDocument = Post & Document;
export const PostSchema = SchemaFactory.createForClass(Post);
