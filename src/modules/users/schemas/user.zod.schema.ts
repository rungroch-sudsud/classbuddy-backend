import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const UpdateProfileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').optional().describe('ชื่อจริง').default('สมชาย'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล').optional().describe('นามสกุล').default('ชายสุด'),
  nickName: z.string().min(1, 'กรุณากรอกชื่อเล่น').optional().describe('ชื่อเล่น').default('คลาส'),
  age: z.number().int().positive().optional().describe('อายุ').default(24),
  subject: z.array(z.string()).optional().describe('วิชา').default(['คณิตศาสตร์', 'วิทยาศาสตร์']),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) { }


export const CreateTeacherProfileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').default('ไฮเซนเบิร์ก'),
  lastName: z.string().optional().default('ไวท์'),
  bio: z.string().optional().default('เคมีม.ปลาย'),
  description: z.string().optional().default('ครูไวท์ มีประสบการณ์สอนเคมี ม.ปลายมากกว่า 5 ปี...'),
  skills: z.array(z.string()).default(['เคมี', 'ฟิสิกส์']),
  hourlyRate: z.number().min(1, 'Hourly rate must be greater than 0').default(50),
  experince: z.number().default(0),
  language: z.string().optional().default('ไทย'),
  videoLink: z.string().url().optional().default('https://youtube.com/me'),
  verify: z.string().optional().default('image'),
});

export class CreateTeacherProfileDto extends createZodDto(CreateTeacherProfileSchema) {}
