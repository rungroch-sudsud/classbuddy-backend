import { Injectable } from '@nestjs/common';
import { StreamClient } from '@stream-io/node-sdk';
import { StreamChat } from 'stream-chat';

@Injectable()
export class StreamChatService {
    private readonly client: StreamChat;
    private readonly videoClient: StreamClient;

    constructor() {
        const apiKey = process.env.STREAM_KEY!;
        const apiSecret = process.env.STREAM_SECRET!;

        this.client = StreamChat.getInstance(apiKey, apiSecret);
        this.videoClient = new StreamClient(apiKey, apiSecret);
    }

    getClient() {
        return this.client;
    }

    async upsertUser(user: { id: string; name?: string; image?: string }) {
        await this.client.upsertUser(user);
    }

    async partialUpdateUser(updateData: any) {
        return this.client.partialUpdateUser(updateData);
    }

    createUserToken(userId: string) {
        return this.client.createToken(userId);
    }

    // async createOrGetCallRoom(teacherId: string, studentId: string) {
    //     const callId = `lesson_${teacherId}_${studentId}`;
    //     const call = this.videoClient.video.call('default', callId);

    //     await call.getOrCreate({
    //         data: { created_by_id: teacherId },
    //     });

    //     // 2️⃣ เพิ่มสมาชิกภายหลัง
    //     await call.updateCallMembers({
    //         update_members: [
    //             { user_id: teacherId, role: 'host' },
    //             { user_id: studentId, role: 'guest' },
    //         ],
    //     });

    //     const token = this.videoClient.createToken(teacherId);

    //     return { callId, token };
    // }

    // createVideoToken(userId: string) {
    //     return this.videoClient.createToken(userId);
    // }
}
