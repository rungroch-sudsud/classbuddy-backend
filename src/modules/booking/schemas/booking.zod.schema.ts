import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


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

export class CreateTeacherProfileDto extends createZodDto(CreateTeacherProfileSchema) { }
