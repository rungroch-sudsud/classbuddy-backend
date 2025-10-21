import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'รหัส ObjectId ไม่ถูกต้อง');

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(4, 'กรุณากรอกชื่อ')
    .max(50, 'ชื่อจริงห้ามเกิน 50 ตัวอักษร')
    .optional()
    .describe('ชื่อจริง'),
  lastName: z
    .string()
    .min(4, 'กรุณากรอกนามสกุล')
    .max(50, 'นามสกุลห้ามเกิน 50 ตัวอักษร')
    .optional()
    .describe('นามสกุล'),
  email: z
    .string()
    .email('กรุณากรอกอีเมลให้ถูกต้อง')
    .min(4, 'กรุณากรอกอีเมล')
    .max(50, 'อีเมลห้ามเกิน 50 ตัวอักษร')
    .optional()
    .describe('อีเมล'),
  nickName: z.
    string()
    .min(1, 'กรุณากรอกชื่อเล่น')
    .max(20, 'ชื่อเล่นห้ามเกิน 20 ตัวอักษร')
    .optional()
    .describe('ชื่อเล่น'),
  age:
    z.number()
      .int()
      .positive()
      .optional()
      .describe('อายุ'),
  subjects: z
    .array(objectIdSchema)
    .min(1, 'ต้องมีอย่างน้อย 1 วิชา')
    .optional()
    .describe('วิชา')
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) { }

