import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { teacherBaseSchema } from '../schemas/teacher.zod.schema';
import { Teacher } from '../schemas/teacher.schema';
import { Wallet } from 'src/modules/payments/schemas/wallet.schema';
import { Role } from 'src/modules/auth/role/role.enum';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export interface WalletResponse {
  _id: string;
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  lockedBalance: number;

  role: Role;

}
export interface TeacherResponse {
  _id: string;
  userId: string;

  name: string;
  lastName: string;
  bio?: string;

  subjects?: string[]; // ObjectId[]

  customSubjects?: string;
  experience?: number;
  hourlyRate: number;
  averageRating?: number;
  reviewCount?: number;
  satisfactionRate: number;

  totalTeachingHours?: number;
  totalTeachingClass?: number;
  totalStudentInClass?: number;

  educationHistory?: {
    level: string;
    institution: string;
  }[];

  language?: string[];
  videoLink?: string;
  certificate?: string[];

  idCardWithPerson?: string | null;

  reviews: {
    reviewerId: string; // ObjectId → string
    rating: number;
    comment?: string;
    createdAt: Date;
  }[];

  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;

  verifyStatus: 'draft' | 'pending' | 'process' | 'verified';

  recipientId?: string;
  lastPayoutAt?: Date;
}


export interface CreateTeacherResponse {
  teacher: TeacherResponse;
  wallet: WalletResponse;
}



export const ReviewSummarySchema = z.object({
  averageRating: z.number(),
  reviewCount: z.number().int(),
  satisfactionRate: z.number().int(),
});

export class ReviewResponseDto extends createZodDto(ReviewSummarySchema) { }


export const PaymentHistoryResponseSchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  totalPayoutAmount: z.number(),
  totalTeacherNet: z.number(),
  totalCommission: z.number(),
  availableBalance: z.number(),
  processingBalance: z.number(),
});

export class PaymentHistoryResponseDto extends createZodDto(
  PaymentHistoryResponseSchema
) { }