import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Slot } from './schemas/slot.schema';
import { Model, Types } from 'mongoose';
import { Teacher } from '../teachers/schemas/teacher.schema';

@Injectable()
export class SlotsService {
    constructor(
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(Teacher.name) private readonly teacherModel: Model<Teacher>
    ) { }

    private combineDateAndTime(dateStr: string, timeStr: string): Date {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            throw new BadRequestException(`รูปแบบวันที่ไม่ถูกต้อง: ${dateStr}`);
        }
        if (isNaN(hours) || isNaN(minutes)) {
            throw new BadRequestException(`รูปแบบเวลาไม่ถูกต้อง: ${timeStr}`);
        }

        return new Date(year, month - 1, day, hours, minutes);
    }

    private toLocalTime(date: Date | string) {
        if (!date) return null;
        return new Date(date).toLocaleTimeString('th-TH', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    }


    async createSlots(
        teacherId: string,
        body: any
    ) {
        const teacher = await this.teacherModel.findOne({ userId: new Types.ObjectId(teacherId) });
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');
        const teacherObjId = teacher._id;
        const docs: any[] = [];

        const hasCustom = !!(body.date && body.startTime && body.endTime);
        const hasWeekly = !!(body.from && body.to && body.weeklySlots);

        if (hasCustom && hasWeekly) {
            throw new BadRequestException('เลือกได้แค่ slotsByDate หรือ recurring rule อย่างใดอย่างหนึ่ง');
        }

        if (hasCustom) {
            const startTime = this.combineDateAndTime(body.date, body.startTime);
            const endTime = this.combineDateAndTime(body.date, body.endTime);

            if (startTime >= endTime) {
                throw new BadRequestException('startTime ต้องน้อยกว่า endTime');
            }

            const overlap = await this.slotModel.exists({
                teacherId: teacherObjId,
                date: body.date,
                $or: [
                    {
                        startTime: { $lt: endTime },
                        endTime: { $gt: startTime },
                    },
                ],
            });

            if (overlap) throw new BadRequestException('ไม่สามารถสร้างเวลาซ้ำได้');

            const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            // const price = teacher.hourlyRate * durationHours;

            docs.push({
                insertOne: {
                    document: {
                        teacherId: teacherObjId,
                        date: new Date(body.date),
                        startTime,
                        endTime,
                        // price,
                        status: 'available',
                        bookedBy: null,
                    },
                },
            });
        }

        if (hasWeekly) {
            const startDate = new Date(body.from);
            const endDate = new Date(body.to);

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dayOfWeek = d.getDay();
                const dayKey = dayOfWeek === 0 ? '7' : String(dayOfWeek);

                const daySlots = body.weeklySlots[dayKey];
                if (!daySlots || daySlots.length === 0) continue;

                const baseDate = new Date(d);
                baseDate.setHours(0, 0, 0, 0);

                for (const t of daySlots) {
                    const [sh, sm] = t.startTime.split(':').map(Number);
                    const [eh, em] = t.endTime.split(':').map(Number);

                    const startTime = this.combineDateAndTime(
                        baseDate.toISOString().split('T')[0],
                        t.startTime
                    );
                    const endTime = this.combineDateAndTime(
                        baseDate.toISOString().split('T')[0],
                        t.endTime
                    );

                    if (startTime >= endTime) {
                        throw new BadRequestException(
                            `ช่วงเวลาไม่ถูกต้อง ${baseDate.toISOString()}: ${t.startTime} - ${t.endTime}`
                        );
                    }
                    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                    // const price = teacher.hourlyRate * durationHours;

                    docs.push({
                        updateOne: {
                            filter: { teacherId: teacherObjId, startTime, endTime },
                            update: {
                                $setOnInsert: {
                                    teacherId: teacherObjId,
                                    date: baseDate,
                                    startTime,
                                    endTime,
                                    // price,
                                    status: 'available',
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

        const newSlots = await this.slotModel.bulkWrite(docs, { ordered: false });

        return { success: true, count: newSlots.upsertedCount, data: newSlots };
    }


    async getAllSlots(): Promise<any[]> {
        return this.slotModel.find()
    }


    async getMineSlot(userId: string): Promise<any> {
        const teacher = await this.teacherModel.findOne({ 
            userId: new Types.ObjectId(userId) 
        });
        
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        const slots = await this.slotModel.find({ teacherId: teacher._id }).lean();

        return slots.map(({ startTime, endTime, ...rest }) => ({
            ...rest,
            startTime: this.toLocalTime(startTime),
            endTime: this.toLocalTime(endTime),
        }));
    }


}

