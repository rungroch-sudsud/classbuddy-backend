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


const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const weeklySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeklySlots: z.record(z.string(), z.array(z.object({
    startTime: timeString,
    endTime: timeString,
  }))),
});

export class CreateWeeklySlotDto extends createZodDto(weeklySchema) {}
