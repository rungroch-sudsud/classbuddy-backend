import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreateProposalSchema = z.object({
    detail: z
        .string()
        .min(1, 'กรุณากรอกรายละเอียดของโพส')
        .min(30, 'ข้อความของโพสต้องมีอย่างน้อย 30 ตัวอักษร'),
});

export class CreateProposalDto extends createZodDto(CreateProposalSchema) {}
