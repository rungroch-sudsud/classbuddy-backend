import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const CreateTeacherProfileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').default('ไฮเซนเบิร์ก'),
  lastName: z.string().optional().default('ไวท์'),
  subject: z.string(),
  bio: z.string().optional().default('เคมีม.ปลาย'),
  description: z.string().optional().default('ครูไวท์ มีประสบการณ์สอนเคมี ม.ปลายมากกว่า 5 ปี...'),
  skills: z.array(z.string()).default(['เคมี', 'ฟิสิกส์']),
  hourlyRate: z.number().min(1, 'Hourly rate must be greater than 0').default(50),
  experince: z.number().default(0),
  language: z.string().optional().default('ไทย'),
  videoLink: z.string().url().optional().default('https://youtube.com/me'),
  verify: z.string().optional().default('image'),
});

export class CreateTeacherProfileDto extends createZodDto(CreateTeacherProfileSchema) { }


export const UpdateTeacherSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').optional(),
  lastName: z.string().optional(),
  subject: z
    .string()
    .optional(),
  bio: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
  hourlyRate: z.number().min(1, 'Hourly rate ต้องมากกว่า 0').optional(),
  experience: z.number().min(0).optional(),
  language: z.array(z.string()).optional(),
  videoLink: z.string().url('กรุณาใส่ลิงก์ที่ถูกต้อง').optional(),
});

export class UpdateTeacherDto extends createZodDto(UpdateTeacherSchema) { }


export const updateTeacherBankSchema = z.object({
  bankName: z.string().min(1, 'กรุณากรอกชื่อธนาคาร'),
  bankAccountName: z.string().min(1, 'กรุณากรอกชื่อบัญชี'),
  bankAccountNumber: z
    .string()
    .min(5, 'เลขบัญชีไม่ถูกต้อง')
    .max(20, 'เลขบัญชีไม่ถูกต้อง'),
});

export class UpdateTeacherBankDto extends createZodDto(updateTeacherBankSchema) { }