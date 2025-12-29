import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateBookingSchema = z.object({
    subject: z.string().regex(/^[0-9a-fA-F]{24}$/, 'รหัสวิชาไม่ถูกต้อง'),
    date: z.string('กรุณาเลือกวันที่ต้องการเรียน'),
    startTime: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            'กรุณาเลือกเวลาเริ่มต้นที่ถูกต้อง',
        ),
    endTime: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            'กรุณาเลือกเวลาสิ้นสุดที่ถูกต้อง',
        ),
    teacherId: z.string('กรุณาเลือกครู'),
});

export class CreateBookingDto extends createZodDto(CreateBookingSchema) {}

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
