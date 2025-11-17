import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SingleSlotSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),

  repeatDailyForDays: z.null().optional(),
  repeatWeeklyForWeeks: z.null().optional(),
});

export class SingleSlotDto extends createZodDto(SingleSlotSchema) {}

export const DailyRecurringSlotSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),

  repeatDailyForDays: z.number().int().positive(),

  repeatWeeklyForWeeks: z.null().optional(),
});

export class DailyRecurringSlotDto extends createZodDto(DailyRecurringSlotSchema) {}

export const WeeklyRecurringSlotSchema = z.object({
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),

  repeatWeeklyForWeeks: z.number().int().positive(),

  repeatDailyForDays: z.null().optional(),
});

export class WeeklyRecurringSlotDto extends createZodDto(WeeklyRecurringSlotSchema) {}



