import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RescheduleClassSchema = z.object({
    newStartTime: z
        .string()
        .datetime({ message: 'กรุณาเลือกเวลาเริ่มต้นที่ถูกต้อง' }),
    newEndTime: z
        .string()
        .datetime({ message: 'กรุณาเลือกเวลาสิ้นสุดที่ถูกต้อง' }),
});

export class RescheduleClassDto extends createZodDto(RescheduleClassSchema) {}

