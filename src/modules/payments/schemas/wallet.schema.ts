import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from 'mongoose'
import { Role } from "src/modules/auth/role/role.enum";
import { User } from "src/modules/users/schemas/user.schema";



@Schema({ timestamps: true })
export class Wallet {
    @Prop({ type: Types.ObjectId, ref: User.name, required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, default: 0 })
    availableBalance: number;

    @Prop({ required: true, default: 0 })
    pendingBalance: number;

    @Prop({ required: true, default: 0 })
    lockedBalance: number;

  @Prop({
    type: String,
    enum: Role,
    default: Role.User,
  })
  role: Role;
}

export type WalletDocument = Wallet & Document;
export const WalletSchema = SchemaFactory.createForClass(Wallet);
