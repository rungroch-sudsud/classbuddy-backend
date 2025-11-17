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
import { getErrorMessage } from 'src/shared/utils/shared.util';

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
