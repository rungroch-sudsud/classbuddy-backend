import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from 'src/modules/auth/role/role.enum';
import { SubjectList } from 'src/modules/subjects/schemas/subject.schema';
import { infoLog } from 'src/shared/utils/shared.util';

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

    @Prop({ default: null })
    emailVerifiedAt: Date;

    @Prop({ type: String })
    emailVerifyToken?: string;

    @Prop({ type: Date })
    emailVerifyTokenExpires?: Date;

    @Prop({ type: String, default: null })
    expoPushToken: string | null;
}

type UserDocument = User & Document;
const UserSchema = SchemaFactory.createForClass(User);

export { UserSchema, type UserDocument };
