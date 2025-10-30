import { Injectable } from '@nestjs/common';
import { StreamChat } from 'stream-chat';
import { envConfig } from 'src/configs/env.config';

@Injectable()
export class StreamChatService {
    private readonly client: StreamChat;

    constructor() {
        const apiKey = process.env.STREAM_KEY!;
        const apiSecret = process.env.STREAM_SECRET!;

        this.client = StreamChat.getInstance(apiKey, apiSecret);
    }

    getClient() {
        return this.client;
    }

    async upsertUser(
        user: { id: string; name?: string; image?: string }
    ) {
        await this.client.upsertUser(user);
    }

    createUserToken(userId: string) {
        return this.client.createToken(userId);
    }




}