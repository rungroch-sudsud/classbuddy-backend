import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const CreateBookingSchema = z.object({
    subject: z.string().regex(/^[0-9a-fA-F]{24}$/, 'รหัสวิชาไม่ถูกต้อง'),
})

export class CreateBookingDto extends createZodDto(CreateBookingSchema) { }
