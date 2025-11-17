import { Injectable } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketEvent } from '../../shared/enums/socket.enum';

@Injectable()
export class SocketService {
    constructor(private gateway: SocketGateway) {}

    sendToUser(userId: string, payload: any) {
        this.gateway.sendToUser(userId, payload);
    }

    isOnline(userId: string): boolean {
        return this.gateway.isOnline(userId);
    }

    emit(socketEvent: SocketEvent, payload: any) {
        this.gateway.emit(socketEvent, payload);
    }
}
