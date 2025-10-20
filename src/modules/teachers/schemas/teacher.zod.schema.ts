import { Types } from 'mongoose';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'รหัส ObjectId ไม่ถูกต้อง');


export const EducationSchema = z.object({
  level: z
    .string()
    .min(1, 'กรุณาเลือกระดับการศึกษา')
    .describe('ระดับการศึกษา'),
  institution: z
    .string()
    .min(1, 'กรุณากรอกชื่อสถานศึกษา')
    .describe('ชื่อสถานศึกษา'),
});


export const CreateTeacherProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'กรุณากรอกชื่อ'),
  lastName: z.
    string()
    .optional(),
  bio: z
    .string()
    .optional(),
  subjects: z
    .array(objectIdSchema)
    .min(1, 'ต้องมีอย่างน้อย 1 วิชา')
    .optional()
    .describe('วิชา'),
  hourlyRate: z
    .number()
    .min(300, 'ค่าต่อชั่วโมงต้องไม่ต่ำกว่า 300 บาท')
    .max(3000, 'ค่าต่อชั่วโมงต้องไม่เกิน 3000 บาท'),
  educationHistory: z
    .array(EducationSchema)
    .optional(),
  experience: z
    .number()
    .optional(),
  language: z
    .string()
    .optional(),
  videoLink: z
    .string()
    .url()
    .optional(),
});

export class CreateTeacherProfileDto extends createZodDto(CreateTeacherProfileSchema) { }


export const UpdateTeacherSchema = z.object({
  name: z
    .string()
    .min(1, 'กรุณากรอกชื่อ')
    .optional(),
  lastName: z
    .string()
    .optional(),
  bio: z
    .string()
    .optional(),
  subjects: z
    .array(objectIdSchema)
    .min(1, 'ต้องมีอย่างน้อย 1 วิชา')
    .optional()
    .describe('วิชา'),
  hourlyRate: z.number().min(300, 'Hourly rate ต้องมากกว่า 300').optional(),
  educationHistory: z
    .array(EducationSchema)
    .optional(),
  language: z.array(z.string()).optional(),
  videoLink: z.string().url('กรุณาใส่ลิงก์ที่ถูกต้อง').optional(),
});

export class UpdateTeacherDto extends createZodDto(UpdateTeacherSchema) { }


export const updateTeacherBankSchema = z.object({
  bankName: z
    .string()
    .min(1, 'กรุณากรอกชื่อธนาคาร'),
  bankAccountName: z
    .string()
    .min(1, 'กรุณากรอกชื่อบัญชี'),
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