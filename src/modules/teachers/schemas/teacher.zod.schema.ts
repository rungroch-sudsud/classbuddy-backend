import { Types } from 'mongoose';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const EducationSchema = z.object({
  level: z
    .string()
    .min(1, 'กรุณาเลือกระดับการศึกษา')
    .describe('ระดับการศึกษา')
    .default('ปริญญาตรี'),

  institution: z
    .string()
    .min(1, 'กรุณากรอกชื่อสถานศึกษา')
    .describe('ชื่อสถานศึกษา')
    .default('มหาวิทยาลัยเกษตรศาสตร์'),

  faculty: z
    .string()
    .min(1, 'กรุณากรอกชื่อคณะ')
    .describe('คณะ')
    .default('คณะศึกษาศาสตร์'),

  major: z
    .string()
    .min(1, 'กรุณากรอกชื่อสาขา')
    .describe('สาขา / ภาควิชา')
    .default('วิชาเอกการสอนคณิตศาสตร์'),
});


export const CreateTeacherProfileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').default('ไฮเซนเบิร์ก'),
  lastName: z.string().optional().default('ไวท์'),
  subject: z.string().default('68dc04e789c7812ddcd30b52'),
  bio: z.string().optional().default('ครูไวท์ มีประสบการณ์สอนเคมี ม.ปลายมากกว่า 5 ปี...'),
  hourlyRate: z.number().min(1, 'Hourly rate must be greater than 0').default(300),
  educationHistory: z
    .array(EducationSchema)
    .optional()
    .default([
      {
        level: 'ปริญญาตรี',
        institution: 'มหาวิทยาลัยเกษตรศาสตร์',
        faculty: 'คณะศึกษาศาสตร์',
        major: 'วิชาเอกการสอนคณิตศาสตร์',
      },
    ]),
  language: z.string().optional().default('ไทย'),
  videoLink: z.string().url().optional().default('https://youtube.com/me'),
});

export class CreateTeacherProfileDto extends createZodDto(CreateTeacherProfileSchema) { }


export const UpdateTeacherSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ').default('ไฮเซนเบิร์ก').optional(),
  lastName: z.string().default('ไวท์').optional(),
  subject: z
    .string()
    .default('68dc04e789c7812ddcd30b52')
    .optional(),
  bio: z.string().default('ครูไวท์ มีประสบการณ์สอนเคมี ม.ปลายมากกว่า 5 ปี...').optional(),
  hourlyRate: z.number().min(300, 'Hourly rate ต้องมากกว่า 300').optional(),
  educationHistory: z
    .array(EducationSchema)
    .optional()
    .default([
      {
        level: 'ปริญญาตรี',
        institution: 'มหาวิทยาลัยเกษตรศาสตร์',
        faculty: 'คณะศึกษาศาสตร์',
        major: 'วิชาเอกการสอนคณิตศาสตร์',
      },
    ]),
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


export const reviewTeacherSchema = z.object({
  rating: z.preprocess(
    (val) => Number(val),
    z
      .number()
      .min(1, 'คะแนนต่ำสุดคือ 1')
      .max(5, 'คะแนนสูงสุดคือ 5')
      .refine((val) => !isNaN(val), { message: 'กรุณาใส่คะแนนรีวิวเป็นตัวเลข' })
  ),
  comment: z
    .string()
    .min(1, 'กรุณาใส่ความคิดเห็นอย่างน้อย 1 ตัวอักษร')
    .max(500, 'ความคิดเห็นยาวเกินไป')
    .optional(),
});

export class reviewTeacherDto extends createZodDto(reviewTeacherSchema) { }