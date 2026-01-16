import { createZodDto } from 'nestjs-zod';
import z from 'zod/v3';

export const CreateAnnouncementSchema = z.object({
    externalUrl: z.string().url('รูปแบบ link ไม่ถูกต้อง').optional(),
});

export class CreateAnnouncementDto extends createZodDto(
    CreateAnnouncementSchema,
) {}
