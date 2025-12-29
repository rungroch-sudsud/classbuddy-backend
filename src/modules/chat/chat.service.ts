import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { infoLog } from 'src/shared/utils/shared.util';
import { Message } from 'stream-chat';
import { User } from '../users/schemas/user.schema';
import { StreamChatService } from './stream-chat.service';

@Injectable()
export class ChatService {
    constructor(
        private readonly streamChatService: StreamChatService,
        @InjectModel(User.name) private readonly userModel: Model<User>,
    ) {}

    async onModuleInit() {
        const chatClient = this.streamChatService.getClient();

        await chatClient.updateChannelType('messaging', { reminders: true });
        const halfAnHour: number = 60 * 30;

        await chatClient.updateAppSettings({
            reminders_interval: halfAnHour,
            user_response_time_enabled: true,
        });

        infoLog('CHAT SERVICE', 'Enable reminders for all channels');
    }

    async bootstrapUserAndIssueToken(userId: string) {
        const user = await this.userModel.findById(userId).lean();
        if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');

        const userStreamId = `${userId}`;
        const userToken = this.streamChatService.createUserToken(userStreamId);

        return userToken;
    }

    async createOrGetChannel(studentId: string, teacherId: string) {
        const client = this.streamChatService.getClient();
        const [a, b] = [studentId, teacherId];
        const channelId = `stud_${a}_teac_${b}`;

        let channel = client.channel('messaging', channelId);

        try {
            const state = await channel.query({});

            if (state?.channel?.id) {
                console.log(
                    `[GETSTREAM] Found existing chat channel: ${channelId}`,
                );
                return channel;
            }
        } catch (err) {
            console.log(
                `[GETSTREAM] Channel not found → creating new one: ${channelId}`,
            );
        }

        channel = client.channel('messaging', channelId, {
            members: [studentId, teacherId],
            created_by_id: studentId,
        });

        console.log(`[GETSTREAM] Created new chat channel: ${channelId}`);
        await channel.create();

        return channel;
    }

    async sendChatMessage({
        channelId,
        message,
        senderUserId,
        metadata,
    }: {
        channelId: string;
        message: string;
        senderUserId: string;
        metadata?: Record<string, any>;
    }): Promise<void> {
        const client = this.streamChatService.getClient();
        const channel = client.channel('messaging', channelId);

        const sender = await this.userModel.findById(senderUserId).lean();
        if (!sender) throw new NotFoundException('ไม่พบผู้ใช้งานดังกล่าว');

        let formattedMessage: Message & { metadata?: Record<string, any> } = {
            text: message,
            user_id: senderUserId,
        };

        if (metadata) {
            formattedMessage.metadata = metadata;
        }

        await channel.sendMessage(formattedMessage);
    }
}
