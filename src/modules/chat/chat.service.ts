import { Injectable, BadRequestException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { StreamChatService } from './stream-chat.service';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Model } from 'mongoose';
import { Teacher } from '../teachers/schemas/teacher.schema';

@Injectable()
export class ChatService {
    constructor(
        private readonly streamChatService: StreamChatService,
        @InjectModel(User.name) private readonly userModel: Model<User>,
        @InjectModel(Teacher.name) private readonly teacherModel: Model<Teacher>
    ) { }


    async bootstrapUserAndIssueToken(userId: string) {
        const user = await this.userModel.findById(userId).lean();
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        const userStreamId = `user_${userId}`;
        const userToken = this.streamChatService.createUserToken(userStreamId);

        let teacherToken: string | null = null;

        if (user.role === 'teacher') {
            const teacherStreamId = `teacher_${userId}`;
            teacherToken = this.streamChatService.createUserToken(teacherStreamId);
        }

        return { userToken, teacherToken };
    }


    async createStudentTeacherChannel(studentId: string, teacherId: string) {
        const studentStreamId = `user_${studentId}`;
        const teacherStreamId = `teacher_${teacherId}`;
        const channelId = `stu_${studentId}_teac_${teacherId}`;

        try {
            const client = this.streamChatService.getClient();

            const channel = client.channel('messaging', channelId, {
                members: [studentStreamId, teacherStreamId],
                created_by_id: teacherStreamId,
            });

            await channel.create();
            console.log(`[getStream] created channel ${channelId}`);

            return { channelId, studentStreamId, teacherStreamId };
        } catch (err) {
            console.error('[getStream] Failed to create channel:', err.message);
            throw new InternalServerErrorException('ไม่สามารถสร้างห้องแชทได้');
        }
    }




}
