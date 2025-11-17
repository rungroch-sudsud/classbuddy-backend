import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/modules/auth/role/role.enum';
import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';

@Schema({ timestamps: true })
export class User extends Document {
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

    @Prop({
        type: [
            {
                type: Types.ObjectId,
                ref: SubjectList.name,
            },
        ],
    })
    subjects?: Types.ObjectId[];

    @Prop({ default: 0 })
    studyClass?: number;

    @Prop({
        type: String,
        enum: Role,
        default: Role.User,
    })
    role: Role;

    @Prop({ type: [String], default: [] })
    bookmarks: string[];

    @Prop({
        type: String,
        maxlength: 512,
        trim: true,
    })
    profileImage?: string;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
