import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Teacher } from '../../teachers/schemas/teacher.schema';
import { Wallet } from './wallet.schema';

@Schema({ timestamps: true })
export class PayoutLog extends Document {
  @Prop()
  transferId: string;

  @Prop({ type: Types.ObjectId, ref: Teacher.name })
  teacherId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Wallet.name })
  walletId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop()
  teacherAmount: number;

  @Prop()
  teacherNet?: number;

  @Prop()
  systemFee: number;

  @Prop()
  gatewayFee?: number;

  @Prop({ default: 'pending' })
  status:
    | 'pending'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'reversed';

  @Prop()
  description?: string;

  @Prop()
  transferredAt?: Date;

  @Prop()
  errorMessage?: string;
}

export const PayoutLogSchema = SchemaFactory.createForClass(PayoutLog);
