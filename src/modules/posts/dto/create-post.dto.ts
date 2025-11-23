import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreatePostSchema = z.object({
    detail: z
        .string()
        .min(1, 'กรุณากรอกรายละเอียดของโพส')
        .min(30, 'ข้อความของโพสต้องมีอย่างน้อย 30 ตัวอักษร')
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}
