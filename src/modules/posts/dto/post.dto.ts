import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const CreatePostSchema = z.object({
    detail: z
        .string()
        .min(1, 'กรุณากรอกรายละเอียดของโพส')
        .min(30, 'ข้อความของโพสต้องมีอย่างน้อย 30 ตัวอักษร')
        .max(150, 'ข้อความของโพสต้องมีอย่างน้อย 30 ตัวอักษร')
});

export class CreatePostDto extends createZodDto(CreatePostSchema) {}


export const UpdatePostSchema = z.object({
    detail: z
        .string()
        .min(30, 'ข้อความของโพสต้องมีอย่างน้อย 30 ตัวอักษร')
        .max(150, 'ข้อความของโพสต้องมีอย่างน้อย 30 ตัวอักษร')
        .optional()
});

export class UpdatePostDto extends createZodDto(UpdatePostSchema) {}


export const CreateProposalSchema = z.object({
    detail: z
        .string()
        .min(1, 'กรุณากรอกรายละเอียดของโพส')
        .min(30, 'ข้อความของเสนอต้องมีอย่างน้อย 30 ตัวอักษร')
        .max(150, 'ข้อความของเสนอต้องมีอย่างน้อย 30 ตัวอักษร')
});

export class CreateProposalDto extends createZodDto(CreateProposalSchema) {}
