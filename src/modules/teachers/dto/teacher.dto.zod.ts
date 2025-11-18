import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { teacherBaseSchema } from '../schemas/teacher.zod.schema';

export const createTeacherSchema = teacherBaseSchema.pick({
    bio: true,
    subjects: true,
    customSubjects: true,
    hourlyRate: true,
    experience: true,
    educationHistory: true,
    language: true,
    videoLink: true,
    bankName: true,
    bankAccountName: true,
    bankAccountNumber: true,
})

export class CreateTeacherDto extends createZodDto(createTeacherSchema) { }


export const updateTeacherSchema = teacherBaseSchema.pick({
    bio: true,
    subjects: true,
    customSubjects: true,
    hourlyRate: true,
    educationHistory: true,
    experience: true,
    language: true,
    videoLink: true,
    bankName: true,
    bankAccountName: true,
    bankAccountNumber: true
}).partial();

export class UpdateTeacherDto extends createZodDto(updateTeacherSchema) { }