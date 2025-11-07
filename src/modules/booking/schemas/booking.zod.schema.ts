import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const CreateBookingSchema = z.object({
    subject: z.string().regex(/^[0-9a-fA-F]{24}$/, 'รหัสวิชาไม่ถูกต้อง'),
})

export class CreateBookingDto extends createZodDto(CreateBookingSchema) { }


export const MySlotResponseSchema = z.object({
    _id: z.union([z.string(), z.any()]),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    paidAt: z.string().nullable(),
    teacher: z.object({
        _id: z.string(),
        name: z.string(),
        lastName: z.string(),
        verifyStatus: z.string(),
        profileImage: z.string().nullable(),
    }),
});

export type MySlotResponse = z.infer<typeof MySlotResponseSchema>;
