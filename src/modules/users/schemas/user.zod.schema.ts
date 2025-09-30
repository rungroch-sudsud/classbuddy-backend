import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').optional().describe('ชื่อจริง').default('Somchai'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล').optional().describe('นามสกุล').default('Sudsud'),
  nickName: z.string().min(1, 'กรุณากรอกชื่อเล่น').optional().describe('ชื่อเล่น').default('Boy'),
  age: z.number().int().positive().optional().describe('อายุ').default(24),
  subject: z.array(z.string()).optional().describe('วิชา').default(['Math', 'Science']),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) { }