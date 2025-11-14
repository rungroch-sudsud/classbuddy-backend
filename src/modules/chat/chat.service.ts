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

        const userStreamId = `${userId}`;
        const userToken = this.streamChatService.createUserToken(userStreamId);

        return userToken
    }

    async createOrGetChannel(studentId: string, teacherId: string) {
        const client = this.streamChatService.getClient();
        const [a, b] = [studentId, teacherId]
        const channelId = `stud_${a}_teac_${b}`;

        let channel = client.channel('messaging', channelId);

        try {
            const state = await channel.query({});
            if (state?.channel?.id) {
                console.log(`[GETSTREAM] Found existing chat channel: ${channelId}`);
                return channel;
            }
        } catch (err) {
            console.log(`[GETSTREAM] Channel not found → creating new one: ${channelId}`);
        }

        channel = client.channel('messaging', channelId, {
            members: [studentId, teacherId],
            created_by_id: studentId
        });

        console.log(`[GETSTREAM] Created new chat channel: ${channelId}`);
        await channel.create();

        return channel;
    }


}
