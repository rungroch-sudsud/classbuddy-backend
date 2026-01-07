import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StreamClient } from '@stream-io/node-sdk';
import { Booking } from '../booking/schemas/booking.schema';
import { Slot } from '../slots/schemas/slot.schema';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { getErrorMessage, infoLog } from 'src/shared/utils/shared.util';
import { createObjectId } from '../../shared/utils/shared.util';
import { tryCatch } from 'bullmq';

@Injectable()
export class VideoService {
    private readonly videoClient: StreamClient;

    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    ) {
        this.videoClient = new StreamClient(
            process.env.STREAM_KEY!,
            process.env.STREAM_SECRET!,
        );
    }

    async getOrCreatePracticeCallRoom(teacherUserId: string) {
        const teacher = await this.teacherModel
            .findOne({ userId: createObjectId(teacherUserId) })
            .populate('userId', '_id')
            .lean();

        if (!teacher) throw new NotFoundException('ไม่พบข้อมูลคุณครู');

        const teacherId = teacher.userId?._id?.toString();
        const callRoomId = `practice_${teacherUserId}`;

        try {
            const call = this.videoClient.video.call('default', callRoomId);

            const retrievedCall = await call.getOrCreate({
                data: {
                    created_by_id: teacherId,
                },
            });

            await call.updateCallMembers({
                update_members: [{ user_id: teacherId }],
            });

            infoLog('Video Service', `สร้าง หรือ ดึง ห้องซ้อมสอน สำเร็จ`);

            return {
                success: true,
                message: 'สร้าง หรือ ดึง ห้องซ้อมสอน สำเร็จ',
                callRoomId: retrievedCall.call.id,
            };
        } catch (err) {
            console.error(
                '[STREAM VIDEO] Failed to create video call room:',
                err.message,
            );
            throw new InternalServerErrorException(
                'ไม่สามารถสร้างห้องเรียนได้ในขณะนี้',
            );
        }
    }

    async createCallRoom(bookingId: string) {
        const booking = await this.bookingModel.findById(bookingId);
        if (!booking) throw new NotFoundException('ไม่พบข้อมูลการจอง');

        const teacherDocId = booking.teacherId;

        const teacher = await this.teacherModel
            .findById(teacherDocId)
            .populate('userId', '_id')
            .lean();

        if (!teacher)
            throw new NotFoundException('ไม่พบข้อมูลครูจาก booking นี้');

        const teacherId = teacher.userId?._id?.toString();
        const studentId = booking.studentId.toString();

        if (booking.callRoomId) {
            return { success: true, callRoomId: booking.callRoomId };
        }

        const callRoomId = `lesson_${bookingId}`;

        try {
            const call = this.videoClient.video.call('default', callRoomId);

            await call.getOrCreate({
                data: {
                    created_by_id: teacherId,
                },
            });

            await call.updateCallMembers({
                update_members: [
                    { user_id: teacherId },
                    { user_id: studentId },
                ],
            });

            booking.callRoomId = callRoomId;
            await booking.save();

            await this.slotModel.updateOne(
                { _id: booking.slotId },
                { $set: { callRoomId } },
            );

            infoLog(
                'Video Service',
                `สร้าง callroom สำหรับ bookingId ${bookingId} สำเร็จ`,
            );

            return {
                success: true,
                message: 'สร้างห้องเรียนสำเร็จ',
                callRoomId,
            };
        } catch (err) {
            console.error(
                '[STREAM VIDEO] Failed to create video call room:',
                err.message,
            );
            throw new InternalServerErrorException(
                'ไม่สามารถสร้างห้องเรียนได้ในขณะนี้',
            );
        }
    }

    async deleteCallRoom(bookingId: string) {
        const booking = await this.bookingModel.findById(bookingId);
        if (!booking) throw new NotFoundException('ไม่พบข้อมูลการจอง');
        
        try {
            const call = this.videoClient.video.call(
                'default',
                booking.callRoomId,
            );

            await call.delete();

            infoLog(
                'Video Service',
                `ลบห้องเรียนสำหรับ bookingId ${bookingId} สำเร็จ`,
            );
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            console.error(
                '[STREAM VIDEO] Failed to delete video call room:',
                errorMessage,
            );

            throw new InternalServerErrorException(
                'ไม่สามารถลบห้องเรียนได้ในขณะนี้',
            );
        }
    }

    async joinStudentCall(bookingId: string, userId: string) {
        const booking = await this.bookingModel.findById(bookingId);
        if (!booking) throw new NotFoundException('ไม่พบข้อมูลการจอง');
        if (!booking.callRoomId)
            throw new BadRequestException('ยังไม่มีห้องเรียนสำหรับการจองนี้');

        const token = this.videoClient.createToken(userId);

        return {
            success: true,
            apiKey: process.env.STREAM_KEY!,
            callId: booking.callRoomId,
            token,
        };
    }

    async joinTeacherCall(slotId: string, teacherId: string) {
        const slot = await this.slotModel.findById(slotId);
        if (!slot) throw new NotFoundException('ไม่พบ slot');
        if (!slot.callRoomId)
            throw new BadRequestException('slot นี้ยังไม่มีห้องเรียน');

        const token = this.videoClient.createToken(teacherId);

        return {
            success: true,
            apiKey: process.env.STREAM_KEY!,
            callId: slot.callRoomId,
            token,
        };
    }

    async endCall(bookingId: string) {
        const booking = await this.bookingModel.findById(bookingId);

        if (!booking) throw new NotFoundException('ไม่พบข้อมูลการจอง');

        const callRoomId = booking.callRoomId;

        try {
            const call = this.videoClient.video.call('default', callRoomId);

            await call.end();

            return {
                success: true,
                message: 'จบ call สำเร็จ',
                callRoomId,
            };
        } catch (err: unknown) {
            const errorMesasge = getErrorMessage(err);

            console.error(
                '[STREAM VIDEO] Failed to create video call room:',
                errorMesasge,
            );

            throw new InternalServerErrorException('ไม่สามารถจบ call ได้');
        }
    }
}
