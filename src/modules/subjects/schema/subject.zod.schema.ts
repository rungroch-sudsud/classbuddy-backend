import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const CreateSubjectSchema = z.object({
  name: z
  .string()
  .min(1, 'กรุณากรอกชื่อ')
  .default('คณิตศาสตร์'),
});

export class CreateSubjectDto extends createZodDto(CreateSubjectSchema) { }