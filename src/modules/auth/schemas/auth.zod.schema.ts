import { createZodDto } from "nestjs-zod";
import z from "zod";


export const RegisterSchema = z.object({
  phone: z.string().min(10, 'เบอร์โทรต้องมีอย่างน้อย 10 หลัก').describe('เบอร์โทรศํพท์').default('66'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  confirmPassword: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

export class RegisterDto extends createZodDto(RegisterSchema) { }


export const VerifyOtpSchema = z.object({
  sessionId: z.string().max(100),
  otp: z.string().max(6, 'opt ต้องไม่เกิน 4 ตัว'),
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) { }


export const LoginSchema = z.object({
  phone: z.string().min(10, 'เบอร์โทรต้องมีอย่างน้อย 10 หลัก').describe('เบอร์โทรศํพท์').default('66'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

export class LoginDto extends createZodDto(LoginSchema) { }




