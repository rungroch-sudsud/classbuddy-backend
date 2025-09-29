import { z } from 'zod';


export const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  lastName: z.string().optional(),
  nickName: z.string().optional(),

  age: z.number().int().positive().optional(),

  subject: z.array(z.string()).optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;


export const RegisterSchema = z.object({
  phone: z.string().min(10, 'เบอร์โทรต้องมีอย่างน้อย 10 หลัก'),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  confirmPassword: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;