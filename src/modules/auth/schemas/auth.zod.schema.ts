import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const RegisterSchema = z.object({
    phone: z
        .string()
        .min(10, 'เบอร์โทรต้องมีอย่างน้อย 10 หลัก')
        .describe('เบอร์โทรศํพท์')
        .default('66'),
    password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
    confirmPassword: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

export const VerifyOtpSchema = z.object({
    sessionId: z.string().max(100),
    otp: z.string().max(6, 'opt ต้องไม่เกิน 4 ตัว'),
    platformReferral: z
        .string()
        .min(1, { message: 'กรุณากรอกว่ารู้จักเรามาจาก platform ไหน' }),
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}

export const LoginSchema = z.object({
    phone: z
        .string()
        .min(10, 'เบอร์โทรต้องมีอย่างน้อย 10 หลัก')
        .describe('เบอร์โทรศํพท์')
        .default('66'),
    password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

export class LoginDto extends createZodDto(LoginSchema) {}

export const ResendOtpSchema = z.object({
    sessionId: z.string().max(50, 'session ไม่ถูกต้อง'),
});

export class ResendOtpDto extends createZodDto(ResendOtpSchema) {}

export const forgotPasswordOtpSchema = z.object({
    phone: z
        .string()
        .min(10, 'เบอร์โทรต้องมีอย่างน้อย 10 หลัก')
        .describe('เบอร์โทรศํพท์')
        .default('0'),
});

export class forgotPasswordOtpDto extends createZodDto(
    forgotPasswordOtpSchema,
) {}

export const verifyForgotPasswordSchema = z.object({
    sessionId: z
        .string()
        .nonempty('sessionId ห้ามว่าง')
        .describe('sessionId ที่ได้จากขั้นตอน request-otp'),
    otp: z
        .string()
        .min(4, 'OTP ต้องมีอย่างน้อย 4 หลัก')
        .max(6, 'OTP ต้องมีไม่เกิน 6 หลัก')
        .regex(/^[0-9]+$/, 'OTP ต้องเป็นตัวเลขเท่านั้น')
        .describe('รหัส OTP'),
});

export class VerifyForgotPasswordDto extends createZodDto(
    verifyForgotPasswordSchema,
) {}

export const resetPasswordSchema = z
    .object({
        sessionId: z
            .string()
            .nonempty('sessionId ห้ามว่าง')
            .describe('sessionId ที่ได้จากขั้นตอน verify-otp'),
        newPassword: z
            .string()
            .min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
            .describe('รหัสผ่านใหม่'),
        confirmPassword: z
            .string()
            .min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
            .describe('ยืนยันรหัสผ่านใหม่'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        path: ['confirmPassword'],
        message: 'รหัสผ่านไม่ตรงกัน',
    });

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

export const changePasswordSchema = z
    .object({
        oldPassword: z
            .string()
            .min(6, 'รหัสผ่านเดิมต้องมีอย่างน้อย 6 ตัวอักษร')
            .describe('รหัสผ่านเดิม'),
        newPassword: z
            .string()
            .min(6, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
            .describe('รหัสผ่านใหม่'),
        confirmPassword: z
            .string()
            .min(6, 'ยืนยันรหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
            .describe('ยืนยันรหัสผ่านใหม่'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        path: ['confirmPassword'],
        message: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน',
    });

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
