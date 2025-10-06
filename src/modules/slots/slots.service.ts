import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Slot } from './schemas/slot.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class SlotsService {
    constructor(@InjectModel(Slot.name) private slotModel: Model<Slot>) { }

    private combineDateAndTime(dateStr: string, timeStr: string): Date {
        const baseDateStr = dateStr.split('T')[0]; // "2025-10-06T00:00:00.000Z" → "2025-10-06"
        const [hours, minutes] = timeStr.split(':').map(Number);

        if (isNaN(hours) || isNaN(minutes)) {
            throw new BadRequestException(`รูปแบบเวลาไม่ถูกต้อง: ${timeStr}`);
        }

        const date = new Date(baseDateStr);

        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    async createSlots(
        teacherId: string,
        body: any
    ) {
        const teacherObjId = new Types.ObjectId(teacherId);
        const docs: any[] = [];

        const hasCustom = !!(body.date && body.startTime && body.endTime);
        const hasRecurring = !!(body.from && body.to && body.daysOfWeek && body.slots);

        if (hasCustom && hasRecurring) {
            throw new BadRequestException('เลือกได้แค่ slotsByDate หรือ recurring rule อย่างใดอย่างหนึ่ง');
        }

        if (hasCustom) {
            const baseDate = new Date(body.date);
            baseDate.setHours(0, 0, 0, 0);

            const startTime = this.combineDateAndTime(body.date, body.startTime);
            const endTime = this.combineDateAndTime(body.date, body.endTime);

            if (startTime >= endTime) {
                throw new BadRequestException('startTime ต้องน้อยกว่า endTime');
            }

            docs.push({
                updateOne: {
                    filter: { teacherId: teacherObjId, startTime, endTime },
                    update: {
                        $setOnInsert: {
                            teacherId: teacherObjId,
                            date: baseDate,
                            startTime,
                            endTime,
                            status: body.status ?? 'available',
                            bookedBy: body.bookedBy ?? null,
                        },
                    },
                    upsert: true,
                },
            });
        }

        if (hasRecurring) {
            const startDate = new Date(body.from);
            const endDate = new Date(body.to);

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                if (!body.daysOfWeek.includes(dayOfWeek)) continue;

                const baseDate = new Date(d);
                baseDate.setHours(0, 0, 0, 0);

                for (const t of body.slots) {
                    const [sh, sm] = t.startTime.split(':').map(Number);
                    const [eh, em] = t.endTime.split(':').map(Number);

                    const startTime = new Date(d);
                    startTime.setHours(sh, sm, 0, 0);

                    const endTime = new Date(d);
                    endTime.setHours(eh, em, 0, 0);

                    if (startTime >= endTime) {
                        throw new BadRequestException(
                            `ช่วงเวลาไม่ถูกต้อง ${baseDate.toISOString()}: ${t.startTime} - ${t.endTime}`
                        );
                    }

                    docs.push({
                        updateOne: {
                            filter: { teacherId: teacherObjId, startTime, endTime },
                            update: {
                                $setOnInsert: {
                                    teacherId: teacherObjId,
                                    date: baseDate,
                                    startTime,
                                    endTime,
                                    isBooked: false,
                                    bookedBy: null,
                                },
                            },
                            upsert: true,
                        },
                    });
                }
            }
        }

        if (docs.length === 0) return [];

        const newSlots = await this.slotModel.insertMany(
            docs.map(d => d.updateOne.update.$setOnInsert),
            { ordered: false }
        );

        return { success: true, count: newSlots.length, data: newSlots };
    }


    async getAllSlots(): Promise<any[]> {
        return this.slotModel.find()
    }


    async getMineSlot(
        teacherId: string
    ): Promise<any> {
        const teacherObjId = new Types.ObjectId(teacherId);
        return this.slotModel.find({ teacherId: teacherObjId });
    }
}

