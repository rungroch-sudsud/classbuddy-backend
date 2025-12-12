import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { StreamChatService } from 'src/modules/chat/stream-chat.service';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { User } from 'src/modules/users/schemas/user.schema';
import { BullMQJob } from 'src/shared/enums/bull-mq.enum';
import {
    errorLog,
    getErrorMessage,
    infoLog,
} from 'src/shared/utils/shared.util';
import { Booking } from '../schemas/booking.schema';
import { SlotsService } from 'src/modules/slots/slots.service';
import { VideoService } from 'src/modules/chat/video.service';

@Processor('booking')
export class BookingProcessor extends WorkerHost {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        private readonly streamChatService: StreamChatService,
        private readonly slotsService: SlotsService,
        private readonly videoService: VideoService,
    ) {
        super();
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

            const chatClient = this.streamChatService.getClient();

            const chatChannelId = `stud_${booking.studentId}_teac_${teacher.userId}`;

            const channel = chatClient.channel('messaging', chatChannelId);

            const teacherFullName = `${teacher.name} ${teacher.lastName}`;

            channel.sendMessage({
                text: '[ข้อความอัตโนมัติจากระบบ] : อีก 15 นาทีก็ใกล้จะได้เวลาเริ่มคลาสแล้ว อย่าลืมเตรียมตัวละ!',
                user: {
                    id: teacher.userId.toString(),
                    name: teacherFullName,
                    image: teacher.user.profileImage,
                },
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

                // if (totalParticipants > totalMembers) {
                //     errorLog(
                //         logEntity,
                //         'totalParticipants ไม่ควรจะเกิน totalMembers ได้ (DEV ATTENTION)',
                //     );
                //     return { success: false };
                // }

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

        if (job.name === BullMQJob.END_CALL) {
            const logEntity = 'QUEUE (END_CALL)';
            try {
                const data: Booking & { _id: string } = job.data;

                const bookingId = data._id;

                infoLog(
                    logEntity,
                    `กำลังปิด Call สำหรับคลาสเรียน bookingId : ${bookingId}`,
                );

                const booking = await this.bookingModel
                    .findById(data._id)
                    .lean();

                if (!booking) {
                    errorLog(logEntity, 'ไม่พบการจองดังกล่าว');
                    return { succes: false };
                }

                await this.videoService.endCall(bookingId);

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
    }
}
