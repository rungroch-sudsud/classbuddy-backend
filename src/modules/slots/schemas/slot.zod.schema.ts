import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';


export const CreateSlotSchema = z.object({
    date: z.string().datetime().default('2025-10-07'),      
    startTime: z.string().datetime().default('12:00'),
    endTime: z.string().datetime().default('13:00'),
    status: z.enum(['available', 'booked', 'cancelled', 'expired']).default('available'),
    bookedBy: z.string().nullable().optional(),
});

export class CreateSlotDto extends createZodDto(CreateSlotSchema) { }
