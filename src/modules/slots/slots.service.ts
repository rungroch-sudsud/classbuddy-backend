import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Slot } from './schemas/slot.schema';
import { Model, Types } from 'mongoose';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { Wallet } from '../payments/schemas/wallet.schema';
import { Booking } from '../booking/schemas/booking.schema';
import { Connection } from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/th';
import { Role } from '../auth/role/role.enum';
import { User } from '../users/schemas/user.schema';
import { SlotStatus } from 'src/shared/enums/slot.enum';


dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Bangkok');


@Injectable()
export class SlotsService {
    constructor(
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Teacher.name) private readonly teacherModel: Model<Teacher>,
        @InjectModel(Wallet.name) private readonly walletModel: Model<Wallet>,
        @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
        @InjectConnection() private readonly connection: Connection,
    ) { }


    async createSlots(
        teacherId: string,
        body: any
    ): Promise<any> {
        const teacher = await this.teacherModel.findOne({
            userId: new Types.ObjectId(teacherId)
        });

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        const teacherObjId = teacher._id;
        const docs: any[] = [];

        const hasDailyRecurring = !!body.repeatDailyForDays;
        const hasWeeklyRecurring = !!body.repeatWeeklyForWeeks;

        const hasSingle = !hasDailyRecurring && !hasWeeklyRecurring && !!(
            body.startTime && body.endTime
        );

        if ([hasSingle, hasDailyRecurring, hasWeeklyRecurring].filter(Boolean).length > 1) {
            throw new BadRequestException('เลือกได้แค่ slotsByDate หรือ recurring rule อย่างใดอย่างหนึ่ง');
        }

        if (hasSingle) {
            let startTime = dayjs.tz(`${body.date}T${body.startTime}`, 'Asia/Bangkok');
            let endTime = dayjs.tz(`${body.date}T${body.endTime}`, 'Asia/Bangkok');

            if (endTime.isSame(startTime)) {
                throw new BadRequestException('เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน');
            }

            if (endTime.isBefore(startTime)) {
                // ถ้าสิ้นสุดน้อยกว่าเริ่ม แสดงว่าข้ามเที่ยงคืน → auto +1 วัน
                endTime = endTime.add(1, 'day');
            }

            const startDateObj = startTime.toDate();
            const endDateObj = endTime.toDate();

            const overlap = await this.slotModel.exists({
                teacherId: teacherObjId,
                date: body.date,
                $or: [{
                    startTime: { $lt: endDateObj },
                    endTime: { $gt: startDateObj },
                }]
            });

            if (overlap) throw new BadRequestException('ไม่สามารถสร้างเวลาซ้ำได้');

            const durationHours = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60);
            const price = teacher.hourlyRate * durationHours;

            docs.push({
                insertOne: {
                    document: {
                        teacherId: teacherObjId,
                        date: body.date,
                        startTime: startDateObj,
                        endTime: endDateObj,
                        price,
                        status: 'available',
                        bookedBy: null,
                    },
                },
            });
        }

        if (hasDailyRecurring) {
            const baseDate = dayjs(body.date);
            const repeatDays = Number(body.repeatDailyForDays ?? 7);

            if (isNaN(repeatDays) || repeatDays <= 0) {
                throw new BadRequestException('repeatDailyForDays ต้องเป็นตัวเลขที่มากกว่า 0');
            }

            if (repeatDays > 365) {
                throw new BadRequestException('ไม่สามารถสร้างซ้ำเกิน 365 วันได้');
            }

            for (let i = 0; i < repeatDays; i++) {
                const currentDate = baseDate.add(i, 'day');

                let startTime = dayjs.tz(`${currentDate
                    .format('YYYY-MM-DD')}T${body.startTime}`, 'Asia/Bangkok');
                let endTime = dayjs
                    .tz(`${currentDate
                        .format('YYYY-MM-DD')}T${body.endTime}`, 'Asia/Bangkok');


                if (endTime.isSame(startTime)) {
                    throw new BadRequestException('เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน');
                }

                if (endTime.isBefore(startTime)) {
                    endTime = endTime.add(1, 'day');
                }

                const startDateObj = startTime.toDate();
                const endDateObj = endTime.toDate();

                const overlap = await this.slotModel.exists({
                    teacherId: teacherObjId,
                    date: currentDate.format('YYYY-MM-DD'),
                    $or: [{
                        startTime: { $lt: endDateObj },
                        endTime: { $gt: startDateObj },
                    }]
                });

                if (overlap) throw new BadRequestException('ไม่สามารถสร้างเวลาซ้ำได้');

                const durationHours = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60);
                const price = teacher.hourlyRate * durationHours;

                docs.push({
                    insertOne: {
                        document: {
                            teacherId: teacherObjId,
                            date: currentDate.format('YYYY-MM-DD'),
                            startTime: startDateObj,
                            endTime: endDateObj,
                            price,
                            status: 'available',
                            bookedBy: null,
                        },
                    },
                });
            }
        }

        if (hasWeeklyRecurring) {
            const repeatWeeks = Number(body.repeatWeeklyForWeeks ?? 4);

            if (isNaN(repeatWeeks) || repeatWeeks <= 0) {
                throw new BadRequestException('repeatWeeklyForWeeks ต้องเป็นตัวเลขที่มากกว่า 0');
            }
            if (repeatWeeks > 52) {
                throw new BadRequestException('ไม่สามารถสร้างซ้ำเกิน 30 สัปดาห์ได้');
            }

            const baseDate = dayjs(body.date).tz('Asia/Bangkok');

            for (let i = 0; i < repeatWeeks; i++) {
                const currentDate = baseDate.add(i, 'week');

                let startTime = dayjs
                    .tz(`${currentDate.format('YYYY-MM-DD')}T${body.startTime}`, 'Asia/Bangkok');
                let endTime = dayjs
                    .tz(`${currentDate.format('YYYY-MM-DD')}T${body.endTime}`, 'Asia/Bangkok');

                if (endTime.isSame(startTime)) {
                    throw new BadRequestException('เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน');
                }

                if (endTime.isBefore(startTime)) {
                    endTime = endTime.add(1, 'day');
                }

                const startDateObj = startTime.toDate();
                const endDateObj = endTime.toDate();

                const overlap = await this.slotModel.exists({
                    teacherId: teacherObjId,
                    date: currentDate.format('YYYY-MM-DD'),
                    $and: [
                        { startTime: { $lt: endDateObj } },
                        { endTime: { $gt: startDateObj } },
                    ],
                });
                if (overlap) continue;

                const durationHours = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60);
                const price = teacher.hourlyRate * durationHours;

                docs.push({
                    insertOne: {
                        document: {
                            teacherId: teacherObjId,
                            date: currentDate.format('YYYY-MM-DD'),
                            startTime: startDateObj,
                            endTime: endDateObj,
                            price,
                            status: 'available',
                            bookedBy: null,
                        },
                    },
                });
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
        })

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        let slots = await this.slotModel.find({
            teacherId: teacher._id,
            status: { $in: ['pending', 'paid'] }
        })
            .populate('subject', '_id name')
            .populate('bookedBy', '_id name lastName profileImage')
            .populate({
                path : 'booking', 
                populate :[ 
                    {
                    path : 'subject',
                    select : '_id name',    
                    },
                    {
                        path: 'teacherId',
                        select: 'name lastName verifyStatus userId',
                        populate: {
                            path: 'userId',
                            select: 'profileImage',
                        }
                    }
                ],
            })
            .lean<Array<Slot & {booking : any}>>();


        const sorted = slots.sort((a, b) => {
            const statusOrder = { paid: 1, pending: 2 };
            const statusA = statusOrder[a.status] ?? 99;
            const statusB = statusOrder[b.status] ?? 99;

            if (statusA !== statusB) return statusA - statusB;
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

        return sorted.map(({ startTime, endTime, date, booking, ...rest }) => {
            const teacher : any = booking.teacherId;
            const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
            const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

            const dateDisplay = startLocal.locale('th').format('D MMMM YYYY');
            const start = startLocal.format('HH:mm');
            const end = endLocal.format('HH:mm');

            const bookingStartLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
            const bookingEndLocal = dayjs.utc(endTime).tz('Asia/Bangkok');
            const bookingDateDisplay = dayjs(bookingStartLocal).locale('th').format('D MMMM YYYY');
            const bookingStart = bookingStartLocal.format('HH:mm');
            const bookingEnd = bookingEndLocal.format('HH:mm');
            const bookingPaidAtDisplay = booking.paidAt ? dayjs(booking.paidAt).locale('th').format('D MMMM YYYY') : null;

            const formattedBoking = {
                ...booking,
                date: bookingDateDisplay,
                startTime: bookingStart,
                endTime: bookingEnd,
                paidAt: bookingPaidAtDisplay,
                teacher :  {
                    _id: teacher?._id,
                    name: teacher?.name,
                    lastName: teacher?.lastName,
                    verifyStatus: teacher?.verifyStatus,
                    profileImage: teacher?.userId?.profileImage ?? null,
                }
                
            }

            delete formattedBoking.teacherId

            return {
                date: dateDisplay,
                startTime: start,
                endTime: end,
                booking : formattedBoking,
                ...rest,
            };
        });
    }


    async getSlotById(
        userId: string,
        slotId: string,
    ): Promise<any> {
        if (!Types.ObjectId.isValid(slotId)) {
            throw new BadRequestException('slot id ไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findOne({
            userId: new Types.ObjectId(userId)
        });

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        const slot = await this.slotModel.findById(slotId)
            .populate('bookedBy', '_id name lastName profileImage')
            .populate('subject', '_id name')
            .sort({ startTime: -1 })
            .lean();

        if (!slot) throw new NotFoundException('ไม่พบ slot นี้');

        if (slot.teacherId?.toString() !== teacher.toString()) {
            throw new ConflictException('คุณไม่มีสิทธิ์เข้าถึง');
        }

        const { startTime, endTime, date, ...rest } = slot;

        const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
        const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

        const dateDisplay = startLocal.locale('th').format('D MMMM YYYY');
        const start = startLocal.format('HH:mm');
        const end = endLocal.format('HH:mm');


        return {
            date: dateDisplay,
            startTime: start,
            endTime: end,
            ...rest
        }
    }

    async getAllSlotByTeacherId(
        teacherId: string,
    ): Promise<any> {
        if (!Types.ObjectId.isValid(teacherId)) {
            throw new BadRequestException('teacher Id ไม่ถูกต้อง');
        }

        const teacher = await this.teacherModel.findById(teacherId)
        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        const slots = await this.slotModel
            .find({ teacherId: teacher._id })
            .sort({ startTime: 1 })
            .lean();


        return slots.map(({ teacherId, startTime, endTime, date, ...rest }) => {
            const startLocal = dayjs(startTime).tz('Asia/Bangkok');
            const endLocal = dayjs(endTime).tz('Asia/Bangkok');

            const dateDisplay = startLocal.locale('th').format('D MMMM YYYY');
            const start = startLocal.format('HH:mm');
            const end = endLocal.format('HH:mm');
            return {
                date: dateDisplay,
                startTime: start,
                endTime: end,
                ...rest,
            };
        });
    }


    async getHistorySlotsMine(userId: string): Promise<any> {
        const teacher = await this.teacherModel.findOne({
            userId: new Types.ObjectId(userId),
        });

        if (!teacher) {
            throw new NotFoundException('ไม่พบข้อมูลครูของผู้ใช้คนนี้');
        }

        const slots = await this.slotModel
            .find({
                teacherId: teacher._id,
                status: { $in: ['studied', 'rejected'] },
            })
            .populate('subject', '_id name')
            .populate({
                path: 'bookedBy',
                select: 'name lastName nickName profileImage'
            })
            .sort({ startTime: -1 })
            .lean();

        return slots.map(({ startTime, endTime, date, ...rest }) => {
            const startLocal = dayjs.utc(startTime).tz('Asia/Bangkok');
            const endLocal = dayjs.utc(endTime).tz('Asia/Bangkok');

            const dateDisplay = startLocal.locale('th').format('D MMMM YYYY');
            const start = startLocal.format('HH:mm');
            const end = endLocal.format('HH:mm');

            return {
                date: dateDisplay,
                startTime: start,
                endTime: end,
                ...rest,

            };
        });
    }


    async finishSlotByTeacher(
        slotId: string,
        userId: string
    ): Promise<Wallet> {
        if (!Types.ObjectId.isValid(slotId)) {
            throw new BadRequestException('slot id ไม่ถูกต้อง');
        }

        const session = await this.connection.startSession();
        session.startTransaction();

        try {
            const teacher = await this.teacherModel.findOne({
                userId: new Types.ObjectId(userId)
            })
                .session(session);

            if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

            const slot = await this.slotModel.findById(slotId).session(session);
            if (!slot) throw new NotFoundException('ไม่พบ slot นี้');

            if (slot.teacherId.toString() !== teacher._id.toString()) {
                throw new ForbiddenException('คุณไม่มีสิทธิ์ใน slot นี้');
            }

            if (slot.status !== SlotStatus.PAID) {
                throw new BadRequestException('สามารถจบคลาสได้เฉพาะ slot ที่อยู่ในสถานะ "paid" เท่านั้น');
            }

            slot.status = SlotStatus.STUDIED;
            await slot.save({ session });

            await this.bookingModel.updateOne(
                { _id: slot.bookingId },
                { $set: { status: 'studied' } },
                { session }
            );

            // Wallet Section
            const wallet = await this.walletModel
                .findOne({ userId: teacher._id })
                .session(session);

            if (!wallet) throw new NotFoundException('ไม่พบกระเป๋าเงินของครู');

            if (wallet.pendingBalance < slot.price) {
                throw new BadRequestException('ยอดเงินในกระเป๋าไม่ถูกต้อง');
            }

            wallet.pendingBalance -= slot.price;
            wallet.availableBalance += slot.price;
            await wallet.save({ session });

            // Teaching Counter Section
            const durationHours =
                (slot.endTime.getTime() - slot.startTime.getTime()) /
                (1000 * 60 * 60);

            await this.teacherModel.updateOne(
                { _id: teacher._id },
                { $inc: { totalTeachingHours: durationHours } },
                { session }
            );

            await this.teacherModel.updateOne(
                { _id: teacher._id },
                { $inc: { totalTeachingClass: 1 } },
                { session }
            );

            const isExistingStudent = await this.slotModel.exists({
                teacherId: teacher._id,
                bookedBy: slot.bookedBy,
                status: SlotStatus.STUDIED,
            });

            if (!isExistingStudent) {
                await this.teacherModel.updateOne(
                    { _id: teacher._id },
                    { $inc: { totalStudentInClass: 1 } },
                    { session }
                );
            }

            await session.commitTransaction();
            return wallet

        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }


    async deleteSlots(teacherId: string, body: any) {
        const teacher = await this.teacherModel.findOne({
            userId: new Types.ObjectId(teacherId),
        });

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลครู');

        const teacherObjId = teacher._id;
        const hasDailyRecurring = !!body.repeatDailyForDays;
        const hasWeeklyRecurring = !!body.repeatWeeklyForWeeks;
        const hasSingle =
            !hasDailyRecurring && !hasWeeklyRecurring && !!(body.startTime && body.endTime);

        if ([hasSingle, hasDailyRecurring, hasWeeklyRecurring].filter(Boolean).length > 1) {
            throw new BadRequestException('เลือกได้แค่ slotsByDate หรือ recurring rule อย่างใดอย่างหนึ่ง');
        }

        let deletedCount = 0;

        if (hasSingle) {
            let startTime = dayjs.tz(`${body.date}T${body.startTime}`, 'Asia/Bangkok');
            let endTime = dayjs.tz(`${body.date}T${body.endTime}`, 'Asia/Bangkok');

            if (endTime.isSame(startTime)) {
                throw new BadRequestException('เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน');
            }

            if (endTime.isBefore(startTime)) {
                endTime = endTime.add(1, 'day');
            }

            const startDateObj = startTime.toDate();
            const endDateObj = endTime.toDate();

            const result = await this.slotModel.deleteOne({
                teacherId: teacherObjId,
                date: body.date,
                startTime: startDateObj,
                endTime: endDateObj,
                status: 'available',
            });

            deletedCount = result.deletedCount ?? 0;
        }

        if (hasDailyRecurring) {
            const baseDate = dayjs(body.date);
            const repeatDays = Number(body.repeatDailyForDays ?? 7);

            if (isNaN(repeatDays) || repeatDays <= 0) {
                throw new BadRequestException('repeatDailyForDays ต้องเป็นตัวเลขที่มากกว่า 0');
            }

            if (repeatDays > 365) {
                throw new BadRequestException('ไม่สามารถลบซ้ำเกิน 30 วันได้');
            }

            for (let i = 0; i < repeatDays; i++) {
                const currentDate = baseDate.add(i, 'day');
                let startTime = dayjs.tz(`${currentDate.format('YYYY-MM-DD')}T${body.startTime}`, 'Asia/Bangkok');
                let endTime = dayjs.tz(`${currentDate.format('YYYY-MM-DD')}T${body.endTime}`, 'Asia/Bangkok');

                if (endTime.isSame(startTime)) {
                    throw new BadRequestException('เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน');
                }

                if (endTime.isBefore(startTime)) {
                    endTime = endTime.add(1, 'day');
                }

                const startDateObj = startTime.toDate();
                const endDateObj = endTime.toDate();

                const result = await this.slotModel.deleteOne({
                    teacherId: teacherObjId,
                    date: currentDate.format('YYYY-MM-DD'),
                    startTime: startDateObj,
                    endTime: endDateObj,
                    status: 'available',
                });

                deletedCount += result.deletedCount ?? 0;
            }
        }

        // 📅 ลบ slot แบบรายสัปดาห์
        if (hasWeeklyRecurring) {
            const repeatWeeks = Number(body.repeatWeeklyForWeeks ?? 4);

            if (isNaN(repeatWeeks) || repeatWeeks <= 0) {
                throw new BadRequestException('repeatWeeklyForWeeks ต้องเป็นตัวเลขที่มากกว่า 0');
            }

            if (repeatWeeks > 52) {
                throw new BadRequestException('ไม่สามารถลบซ้ำเกิน 30 สัปดาห์ได้');
            }

            const baseDate = dayjs(body.date).tz('Asia/Bangkok');

            for (let i = 0; i < repeatWeeks; i++) {
                const currentDate = baseDate.add(i, 'week');

                let startTime = dayjs.tz(`${currentDate.format('YYYY-MM-DD')}T${body.startTime}`, 'Asia/Bangkok');
                let endTime = dayjs.tz(`${currentDate.format('YYYY-MM-DD')}T${body.endTime}`, 'Asia/Bangkok');

                if (endTime.isSame(startTime)) {
                    throw new BadRequestException('เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน');
                }

                if (endTime.isBefore(startTime)) {
                    endTime = endTime.add(1, 'day');
                }

                const startDateObj = startTime.toDate();
                const endDateObj = endTime.toDate();

                const result = await this.slotModel.deleteOne({
                    teacherId: teacherObjId,
                    date: currentDate.format('YYYY-MM-DD'),
                    startTime: startDateObj,
                    endTime: endDateObj,
                    status: 'available',
                });

                deletedCount += result.deletedCount ?? 0;
            }
        }

        return {
            deletedCount,
            // deletedSlots,
        };
    }

    async studentCancelSlotAndRefund(
        studentUserId: string,
        slotId: string
    ): Promise<any> {
        const student = await this.userModel.findById(studentUserId).lean()

        if (!student) throw new BadRequestException('ไม่พบนักเรียนคนนี้');

        const slot = await this.slotModel.findById(slotId)

        if (!slot) throw new BadRequestException('ไม่พบ slot');

        const studentDidNotBookThisClass = student._id.toString() !== slot.bookedBy.toString()

        if (studentDidNotBookThisClass) {
            throw new BadRequestException('คุณไม่ได้ลงสมัคร Class นี้');
        }

        if (slot.status !== SlotStatus.PAID) {
            throw new BadRequestException('ไม่สามารถยกเลิก slot ที่ยังไม่ชำระเงินได้');
        }

        const booking = await this.bookingModel.findOne({ slotId: slot._id })

        if (!booking) throw new BadRequestException('ไม่พบ booking')

        const session = await this.connection.startSession();

        try {
            await session.withTransaction(async () => {

                slot.status = 'canceled';
                await slot.save({ session });

                booking.status = 'canceled';
                await booking.save({ session });

                await this.walletModel.updateOne(
                    { userId: slot.teacherId, role: Role.Teacher },
                    { $inc: { pendingBalance: -booking.price } },
                    { session },
                );

                await this.walletModel.updateOne(
                    { userId: booking.studentId, role: Role.User },
                    { $inc: { availableBalance: booking.price } },
                    { session, upsert: true },
                );

                console.log(
                    `[REFUND] slot ${slot._id} canceled, refunded ${booking.price} THB to student`
                );
            });

        } catch (err) {
            console.error('[REFUND ERROR]', err);
            throw new BadRequestException('ยกเลิก slot ไม่สำเร็จ');
        }
        finally {
            await session.endSession();
        }
    }


}
