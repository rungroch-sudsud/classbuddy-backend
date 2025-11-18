import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


// export const TeacherProfileResponseSchema = TeacherSchemaZ.extend({
//   userId: z.string().nullable(),
//   profileImage: z.string().nullable(),
//   isOnline: z.boolean(),
// });


export const ReviewSummarySchema = z.object({
  averageRating: z.number(),
  reviewCount: z.number().int(),
  satisfactionRate: z.number().int(),
});

export class ReviewResponseDto extends createZodDto(ReviewSummarySchema) {}


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
) {}