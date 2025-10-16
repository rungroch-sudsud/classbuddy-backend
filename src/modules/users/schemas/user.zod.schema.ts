import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(4, 'กรุณากรอกชื่อ')
    .max(50, 'ชื่อจริงห้ามเกิน 50 ตัวอักษร')
    .describe('ชื่อจริง')
    .default('user'),
  lastName: z
    .string()
    .min(4, 'กรุณากรอกนามสกุล')
    .max(50, 'นามสกุลห้ามเกิน 50 ตัวอักษร')
    .optional()
    .describe('นามสกุล')
    .default('lastname')
  ,
  email: z
    .string()
    .email('กรุณากรอกอีเมลให้ถูกต้อง')
    .min(4, 'กรุณากรอกอีเมล')
    .max(50, 'อีเมลห้ามเกิน 50 ตัวอักษร')
    .optional()
    .describe('อีเมล')
    .default('example@email.com'),
  nickName: z.
    string()
    .min(1, 'กรุณากรอกชื่อเล่น')
    .max(20, 'ชื่อเล่นห้ามเกิน 20 ตัวอักษร')
    .optional()
    .describe('ชื่อเล่น')
    .default('คลาส'),
  age:
    z.number()
      .int()
      .positive()
      .optional()
      .describe('อายุ')
      .default(24),
  subject: z
  .array(z.string()).optional().describe('วิชา').default(['68dc066da1fe884fce5a03e4', '68dc052689c7812ddcd30b54']),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) { }

