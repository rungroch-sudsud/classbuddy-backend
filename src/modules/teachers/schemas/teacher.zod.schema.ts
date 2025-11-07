import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'รหัส ObjectId ไม่ถูกต้อง');


const EducationSchema = z.object({
  level: z
    .string()
    .min(1, 'กรุณาเลือกระดับการศึกษา')
    .max(50, 'ระดับการศึกษาไม่ถูกต้อง'),

  institution: z
    .string()
    .min(1, 'กรุณากรอกชื่อสถานศึกษา')
    .max(50, 'ชื่อสถานศึกษาไม่ถูกต้อง'),
});


export const CreateTeacherProfileSchema = z.object({
  bio: z
    .string()
    .min(150, 'bio ขั้นต่ำ 150 ตัวอักษร')
    .optional(),

  subjects: z
    .array(objectIdSchema)
    .min(1, 'ต้องมีอย่างน้อย 1 วิชา')
    .max(100, 'id วิชาต้องไม่เกิน 100 ตัวอักษร'),

  customSubjects: z
    .string().min(2).max(50)
    .optional()
    .nullable(),

  hourlyRate: z
    .number()
    .min(200, 'ค่าต่อชั่วโมงต้องไม่ต่ำกว่า 200 บาท')
    .max(3000, 'ค่าต่อชั่วโมงต้องไม่เกิน 3000 บาท'),

  educationHistory: z
    .array(EducationSchema)
    .optional(),

  experience: z
    .number()
    .min(0, 'ประสบการณ์ต้องไม่ติดลบ')
    .max(80, 'ประสบการณ์ต้องไม่เกิน 80 ปี')
    .optional(),

  language: z
    .array(z.string())
    .max(8, 'เลือกภาษาได้ไม่เกิน 8 ภาษา')
    .optional(),

  videoLink: z
    .string()
    .url('กรุณากรอกลิงก์วิดีโอที่ถูกต้อง')
    .max(500, 'ลิงก์วิดีโอยาวเกินไป')
    .optional(),

  bankName: z
    .string()
    .min(2, 'กรุณากรอกบัญชีธนาคาร')
    .max(20, 'ชื่อธนาคารต้องไม่เกิน 20 ตัวอักษร')
    .optional(),

  bankAccountName: z
    .string()
    .min(5, 'ชื่อบัญชีต้ต้องมีอย่างน้อย 5 หลัก')
    .max(60, 'ชื่อบัญชีต้องไม่เกิน 60 ตัวอักษร')
    .optional(),

  bankAccountNumber: z
    .string()
    .min(10, 'เลขบัญชีต้องมีอย่างน้อย 10 หลัก')
    .max(14, 'เลขบัญชีต้องไม่เกิน 14 ตัวอักษร')
    .optional(),
});

export class CreateTeacherProfileDto extends createZodDto(CreateTeacherProfileSchema) { }


export const UpdateTeacherSchema = z.object({
  bio: z
    .string()
    .max(150, 'bio ต้องไม่เกิน 150 ตัวอักษร')
    .optional(),

  subjects: z
    .array(objectIdSchema)
    .optional(),

  customSubjects: z
    .string().min(2).max(50)
    .optional()
    .nullable(),

  hourlyRate: z
    .number()
    .min(200, 'ค่าต่อชั่วโมงต้องไม่ต่ำกว่า 200 บาท')
    .max(3000, 'ค่าต่อชั่วโมงต้องไม่เกิน 3000 บาท')
    .optional(),

  educationHistory: z
    .array(EducationSchema)
    .optional(),

  experience: z
    .number()
    .min(0, 'ประสบการณ์ต้องไม่ติดลบ')
    .max(80, 'ประสบการณ์ต้องไม่เกิน 80 ปี')
    .optional(),

  language: z
    .array(z.string())
    .min(1, 'ต้องมีอย่างน้อย 1 ภาษา')
    .max(8, 'เลือกภาษาได้ไม่เกิน 8 ภาษา')
    .optional(),

  videoLink: z
    .string()
    .url('กรุณากรอกลิงก์วิดีโอที่ถูกต้อง')
    .max(500, 'ลิงก์วิดีโอยาวเกินไป')
    .optional(),

  bankName: z
    .string()
    .min(2, 'กรุณากรอกบัญชีธนาคาร')
    .max(20, 'ชื่อธนาคารต้องไม่เกิน 20 ตัวอักษร')
    .optional(),

  bankAccountName: z
    .string()
    .min(5, 'ชื่อบัญชีต้องมีอย่างน้อย 5 ตัวอักษร')
    .max(60, 'ชื่อบัญชีต้องไม่เกิน 60 ตัวอักษร')
    .optional(),

  bankAccountNumber: z
    .string()
    .min(10, 'เลขบัญชีต้องมีอย่างน้อย 10 หลัก')
    .max(14, 'เลขบัญชีต้องไม่เกิน 14 ตัวอักษร')
    .optional(),
});

export class UpdateTeacherDto extends createZodDto(UpdateTeacherSchema) { }


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
    .max(500, 'ความคิดเห็นยาวเกินไป')
    .optional(),
});

export class reviewTeacherDto extends createZodDto(reviewTeacherSchema) { }