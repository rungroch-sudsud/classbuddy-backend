import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSlotSchema = z.object({
  date: z.string().min(1, 'กรุณาระบุวันที่').default('2025-10-07'),

  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'รูปแบบเวลาไม่ถูกต้อง (HH:mm)')
    .default('12:00'),

  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'รูปแบบเวลาไม่ถูกต้อง (HH:mm)')
    .default('13:00'),

});

export class CreateSlotDto extends createZodDto(CreateSlotSchema) {}
