import { Injectable } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';

@Injectable()
export class SocketService {
    constructor(private gateway: SocketGateway) { }

    sendToUser(userId: string, payload: any) {
        this.gateway.sendToUser(userId, payload);
    }

    isOnline(userId: string): boolean {
        return this.gateway.isOnline(userId);
    }
}
