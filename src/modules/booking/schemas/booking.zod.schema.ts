import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

export const CreateBookingSchema = z.object({
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),

    startTime: z
        .string()
        .regex(timeRegex, 'เวลาเริ่มต้นต้องอยู่ในรูปแบบ 10:00'),

    endTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/, 'เวลาสื้นสุดต้องอยู่ในรูปแบบ 10:00'),

    subject: z.string().regex(/^[0-9a-fA-F]{24}$/, 'รหัสวิชาไม่ถูกต้อง'),
})
// .superRefine(({ startTime, endTime }, ctx) => {
//     if (!startTime || !endTime) return;
//     if (endTime <= startTime) {
//         ctx.addIssue({
//             code: z.ZodIssueCode.custom,
//             message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น',
//             path: ['endTime'],
//         });
//     }
// });

export class CreateBookingDto extends createZodDto(CreateBookingSchema) { }
