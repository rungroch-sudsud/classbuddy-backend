import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { businessConfig } from 'src/configs/business.config';
import { envConfig } from 'src/configs/env.config';
import { SmsMessageBuilder } from 'src/infra/sms/builders/sms-builder.builder';
import { ChatService } from 'src/modules/chat/chat.service';
import { StreamChatService } from 'src/modules/chat/stream-chat.service';
import { VideoService } from 'src/modules/chat/video.service';
import { Slot } from 'src/modules/slots/schemas/slot.schema';
import { SlotsService } from 'src/modules/slots/slots.service';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { User } from 'src/modules/users/schemas/user.schema';
import { BullMQJob } from 'src/shared/enums/bull-mq.enum';
import {
    devLog,
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { Booking } from '../schemas/booking.schema';
import { SocketService } from 'src/modules/socket/socket.service';
import { SocketEvent } from 'src/shared/enums/socket.enum';

@Processor('booking')
export class BookingProcessor extends WorkerHost {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Slot.name) private slotModel: Model<Slot>,

        private readonly streamChatService: StreamChatService,
        private readonly chatService: ChatService,
        private readonly slotsService: SlotsService,
        private readonly videoService: VideoService,
        private readonly socketService: SocketService,
    ) {
        super();
    }

    private async _handleEndCall(job: Job): Promise<{ success: boolean }> {
        const logEntity = 'QUEUE (END_CALL)';

        try {
            const data: Booking & { _id: string } = job.data;

            const bookingId = data._id;

            infoLog(
                logEntity,
                `กำลังปิด Call สำหรับคลาสเรียน bookingId : ${bookingId}`,
            );

            const booking = await this.bookingModel.findById(data._id).lean();

            if (!booking) {
                errorLog(logEntity, 'ไม่พบการจองดังกล่าว');
                return { success: false };
            }

            // 1. จบ Call
            await this.videoService.endCall(bookingId);

            const teacher = await this.teacherModel
                .findById(booking.teacherId)
                .lean();

            if (!teacher) {
                errorLog(logEntity, 'ไม่พบข้อมูลคุณครูดังกล่าว');
                return { success: false };
            }

            const teacherUserId = teacher.userId.toString();
            const channel = await this.chatService.createOrGetChannel(
                booking.studentId.toString(),
                teacherUserId,
            );
            const channelId = channel.id;

            if (!channelId) {
                errorLog(logEntity, 'ไม่พบข้อมูลแชทดังกล่าว');
                return { success: false };
            }

            // 2. ส่งข้อความ after class check-up เข้าไปในคลาส
            const messageBuilder = new SmsMessageBuilder();

            messageBuilder
                .addText('[ข้อความอัตโนมัติจากระบบ] : ')
                .newLine()
                .addText(
                    'เรียนวันนี้เป็นอย่างไรบ้าง อยากให้คุณครูช่วยสอนเรื่องอะไรเพิ่ม บอกได้เลยนะ 👍',
                );

            const chatMessage = messageBuilder.getMessage();

            if (booking.status === 'paid' || booking.status === 'studied') {
                await this.chatService.sendChatMessage({
                    channelId,
                    message: chatMessage,
                    senderUserId: teacherUserId,
                });
            }

            // 3 : ส่งแบบฟอร์มให้นักเรียน สรุปสิ่งที่เรียนในวันนี้ในคลาส
            const shortNoteMessageBuilder = new SmsMessageBuilder();

            shortNoteMessageBuilder.addText(
                'แบบฟอร์มสรุปสิ่งที่เรียนในวันนี้ในคลาส',
            );

            const shortNoteMessage = shortNoteMessageBuilder.getMessage();

            const shortNoteMetaData: Record<string, any> = {
                customMessageType: 'short-note',
                bookingId,
            };

            await this.chatService.sendChatMessage({
                channelId,
                message: shortNoteMessage,
                senderUserId: teacherUserId,
                metadata: shortNoteMetaData,
            });

            infoLog(
                logEntity,
                `จบ call สำหรับคลาสเรียน bookingId : ${bookingId} สำเร็จ!`,
            );

            return { success: true };
        } catch (error: unknown) {
            const errorMesage = getErrorMessage(error);

            errorLog(logEntity, errorMesage);

            return { success: false };
        }
    }

    async process(job: Job) {
        if (job.name === BullMQJob.NOTIFY_BEFORE_CLASS) {
            const logEntity = 'QUEUE (NOTIFY_BEFORE_CLASS)';

            const data: Booking & { _id: string } = job.data;

            const booking = await this.bookingModel.findById(data._id).lean();

            if (!booking) {
                errorLog(logEntity, `ไม่พบการจองดังกล่าว`);
                return { success: false };
            }

            if (booking.status !== 'paid') {
                infoLog(
                    logEntity,
                    'ไม่ต้องส่งข้อความคลาสก่อนเรียนเนื่องจาก นักเรียนยังไม่ได้จ่ายเงิน',
                );
                return { success: true };
            }

            const teacher = await this.teacherModel
                .findById(booking.teacherId)
                .populate('user')
                .lean<Teacher & { user: User }>();

            if (!teacher) {
                errorLog(logEntity, 'ไม่พบคุณครูสำหรับคลาสนี้');
                return { success: true };
            }

            // const chatClient = this.streamChatService.getClient();
            // const channel = chatClient.channel('messaging', chatChannelId);
            // const teacherFullName = `${teacher.name} ${teacher.lastName}`;

            const chatChannelId = `stud_${booking.studentId}_teac_${teacher.userId}`;
            const messageBuilder = new SmsMessageBuilder();

            messageBuilder
                .addText('[ข้อความอัตโนมัติจากระบบ] : ')
                .newLine()
                .addText(
                    'อีก 15 นาทีก็ใกล้จะได้เวลาเริ่มคลาสแล้ว อย่าลืมเตรียมตัวละ!',
                )
                .newLine()
                .addText(
                    `ลิงค์เข้าคลาส : ${envConfig.frontEndUrl}/classroom/${booking._id.toString()}`,
                );

            const chatMessage = messageBuilder.getMessage();
            const bookingId = booking._id.toString();

            const metadata: Record<string, any> = {
                customMessageType: 'notify-before-class',
                bookingId,
            };

            await this.chatService.sendChatMessage({
                channelId: chatChannelId,
                message: chatMessage,
                senderUserId: teacher.userId.toString(),
                metadata,
            });

            infoLog(
                logEntity,
                'ส่งข้อความแจ้งเตือนให้คุณครูและนักเรียนก่อนเริ่มคลาสสำเร็จ',
            );

            return { success: true };
        }

        if (job.name === BullMQJob.CHECK_PARTICIPANTS_BEFORE_CLASS_ENDS) {
            const logEntity = 'QUEUE (CHECK_PARTICIPANTS_BEFORE_CLASS_ENDS)';
            try {
                const data: Booking & { _id: string } = job.data;

                const booking = await this.bookingModel
                    .findById(data._id)
                    .lean();

                if (!booking) {
                    errorLog(logEntity, `ไม่พบการจองดังกล่าว`);
                    return { success: false };
                }

                if (booking.status !== 'paid') {
                    infoLog(
                        logEntity,
                        'ไม่ต้องส่งตรวจจำนวนผู้เข้าร่วมคลาส เนื่องจาก นักเรียนยังไม่ได้จ่ายเงิน',
                    );
                    return { success: true };
                }

                const videoClient = this.streamChatService.getVideoClient();

                if (!booking.callRoomId) {
                    infoLog(
                        logEntity,
                        'ไม่ต้องจบคลาสเนื่องจาก ไม่มี call room id',
                    );
                    return { success: true };
                }

                const call = videoClient.video.call(
                    'default',
                    booking.callRoomId,
                );

                const { members } = await call.queryMembers(); // : เส้นนี้จะส่งจำนวนคนที่ควรอยู่ในคลาสจริงๆ ไม่ว่าจะ connect หรือไม่ connect

                const totalMembers = members.length;

                const { total_participants: totalParticipants } =
                    await call.queryCallParticipants({
                        filter_conditions: {
                            user_id: {
                                $in: members.map((member) => member.user_id),
                            },
                        },
                    }); // : เส้นนี้จะส่ง list participants เฉพาะที่ connect กับคลาสเท่านั้น ใครไม่ connect ก็จะไม่แสดง

                if (totalParticipants < totalMembers) {
                    infoLog(
                        logEntity,
                        'ไม่ต้องจบคลาสเนื่องจาก คนที่เข้าร่วมคลาสจริงตอนนี้ มีน้อยกว่าที่สมัครมา',
                    );
                    return { success: true };
                }

                const teacher = await this.teacherModel
                    .findById(booking.teacherId)
                    .lean();

                if (!teacher) {
                    errorLog(logEntity, 'ไม่พบข้อมูลคุณครู');
                    return { success: false };
                }

                await this.slotsService.finishSlotByTeacher(
                    booking.slotId,
                    teacher.userId.toString(),
                );

                infoLog(
                    logEntity,
                    `จบคลาสอัตโนมัติสำเร็จ! bookingId (${booking._id})`,
                );

                return { success: true };
            } catch (error: unknown) {
                const errorMessage = getErrorMessage(error);

                errorLog(logEntity, errorMessage);
                return { success: false };
            }
        }

        if (job.name === BullMQJob.END_CALL)
            return await this._handleEndCall(job);

        if (job.name === BullMQJob.AUTO_CANCEL_BOOKING) {
            const logEntity = 'QUEUE (AUTO_CANCEL_BOOKING)';

            devLog(logEntity, 'กำลังยกเลิกการจองอัตโนมัติ...');

            try {
                const data: Booking & { _id: string } = job.data;

                const bookingId = data._id;

                infoLog(
                    logEntity,
                    `กำลังยกเลิกการจอง bookingId : ${bookingId}`,
                );

                const booking = await this.bookingModel
                    .findById(data._id)
                    .lean();

                if (!booking) {
                    errorLog(logEntity, 'ไม่พบการจองดังกล่าว');
                    return { succes: false };
                }

                if (booking.status === 'paid' || booking.status === 'studied') {
                    infoLog(
                        logEntity,
                        'ไม่ต้องยกเลิกการจอง เนื่องจากการจองนี้ได้จ่ายเงินแล้วหรือเรียนจบแล้ว',
                    );
                    return { success: true };
                }

                // 1. ลบ slot ออก
                await this.slotModel.findByIdAndDelete(booking.slotId);

                // 2. ปรับสถานะ booking เป็น expired และลบ slotId ออก
                await this.bookingModel.findByIdAndUpdate(bookingId, {
                    $set: {
                        status: 'expired',
                        slotId: null,
                    },
                });

                // 3. ส่งข้อความการยกเลิกการจองไปในแชท
                const teacher = await this.teacherModel
                    .findById(booking.teacherId)
                    .lean();

                if (!teacher) {
                    errorLog(logEntity, 'ไม่พบข้อมูลคุณครูดังกล่าว');
                    return { success: false };
                }

                const teacherUserId = teacher.userId.toString();

                const channel = await this.chatService.createOrGetChannel(
                    booking.studentId.toString(),
                    teacherUserId,
                );
                const channelId = channel.id;
                if (!channelId) return { success: false };

                const messageBuilder = new SmsMessageBuilder();

                messageBuilder
                    .addText('[ข้อความอัตโนมัติจากระบบ] : ')
                    .newLine()
                    .addText(
                        `การจองคลาสนี้ถูกยกเลิกอัตโนมัติเนื่องจากหมดเวลาชำระเงิน ${businessConfig.payments.expiryMinutes} นาที`,
                    );

                const chatMessage = messageBuilder.getMessage();

                const metadata: Record<string, any> = {
                    customMessageType: 'booking-expired',
                    bookingId,
                };

                await this.chatService.sendChatMessage({
                    channelId,
                    message: chatMessage,
                    senderUserId: teacherUserId,
                    metadata,
                });

                this.socketService.emit(SocketEvent.BOOKING_EXPIRED, {
                    teacherUserId: teacher.userId.toString(),
                    studentId: booking.studentId.toString(),
                });

                infoLog(
                    logEntity,
                    `ยกเลิกการจอง bookingId : ${bookingId} สำเร็จ!`,
                );

                return { success: true };
            } catch (error: unknown) {
                const errorMesage = getErrorMessage(error);

                errorLog(logEntity, errorMesage);

                return { success: false };
            }
        }
    }
}
