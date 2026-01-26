import { createZodDto } from 'nestjs-zod';
import { CreateCourseSchema } from './create-course.dto';

export const UpdateCourseSchema = CreateCourseSchema.partial();

export class UpdateCourseDto extends createZodDto(UpdateCourseSchema) {}
