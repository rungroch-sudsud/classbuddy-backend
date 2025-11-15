import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const createSubjectRequestSchema = z.object({
    name: z
        .string({ message: 'ประเภทข้อมูลไม่ถูกต้อง' })
        .min(4, 'ชื่อวิชาต้องยาวอย่างน้อย 4 ตัวอักษร'),
});

export class CreateSubjectRequestDto extends createZodDto(
    createSubjectRequestSchema,
) {}
