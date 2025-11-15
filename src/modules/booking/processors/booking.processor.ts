import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { BullMQJob } from 'src/shared/enums/bull-mq.enum';
import { Booking } from '../schemas/booking.schema';
import { errorLog, infoLog } from 'src/shared/utils/shared.util';
import { StreamChatService } from 'src/modules/chat/stream-chat.service';
import { Teacher } from 'src/modules/teachers/schemas/teacher.schema';
import { success } from 'zod';
import { User } from 'src/modules/users/schemas/user.schema';

@Processor('booking')
export class BookingProcessor extends WorkerHost {
    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<Booking>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        @InjectModel(User.name) private userModel: Model<User>,
        private readonly streamChatService: StreamChatService,
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
                .lean();

            if (!teacher) {
                errorLog(logEntity, 'ไม่พบคุณครูสำหรับคลาสนี้');
                return { success: true };
            }

            const student = await this.userModel
                .findById(booking.studentId)
                .lean();

            if (!student) {
                errorLog(logEntity, 'ไม่พบนักเรียนของตลาสนี้');
                return { success: true };
            }

            const chatClient = this.streamChatService.getClient();

            const chatChannelId = `stud_${booking.studentId}_teac_${teacher.userId}`;

            const channel = chatClient.channel('messaging', chatChannelId);

            const studentFullName = `${student.name} ${student.lastName}`;

            channel.sendMessage({
                text: '[ข้อความอัตโนมัติจากระบบ] : อีก 15 นาทีก็ใกล้จะได้เวลาเริ่มคลาสแล้ว อย่าลืมเตรียมตัวละ!',
                user: {
                    id: booking.studentId.toString(),
                    name: studentFullName,
                    image: student.profileImage,
                },
            });

            infoLog(
                logEntity,
                'ส่งข้อความแจ้งเตือนให้คุณครูและนักเรียนก่อนเริ่มคลาสสำเร็จ',
            );

            return { success: true };
        }
    }
}
