import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateBookingSchema = z.object({
 
});

export class CreateBookingDto extends createZodDto(CreateBookingSchema) {}
