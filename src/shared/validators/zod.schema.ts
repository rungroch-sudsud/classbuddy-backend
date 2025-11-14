import { z } from 'zod';

export const ImageFileSchema = z.object({
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'ชนิดไฟล์ไม่ถูกต้อง (รองรับ JPG, PNG, WEBP)',
  }),
  size: z
    .number()
    .positive({ message: 'ไฟล์ต้องมีขนาดมากกว่า 0' })
    .max(10 * 1024 * 1024, {
      message: 'ไฟล์ใหญ่เกินกำหนด (ไม่เกิน 10 MB)',
    }),
});


export const FilesSchema = z
  .array(
    z.object({
      mimetype: z.enum(
        ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        {
          message: 'ชนิดไฟล์ไม่ถูกต้อง (รองรับ JPG, PNG, WEBP, PDF)',
        },
      ),
      size: z
        .number()
        .positive({ message: 'ไฟล์ต้องมีขนาดมากกว่า 0' })
        .max(10 * 1024 * 1024, {
          message: 'ไฟล์ใหญ่เกินกำหนด (ไม่เกิน 10 MB)',
        }),
    }),
  )
  .min(1, { message: 'ต้องอัปโหลดอย่างน้อย 1 ไฟล์' })
  .max(3, { message: 'อัปโหลดได้สูงสุด 3 ไฟล์' });
