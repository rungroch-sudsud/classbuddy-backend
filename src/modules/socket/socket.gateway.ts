import { JwtService } from '@nestjs/jwt';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { envConfig } from 'src/configs/env.config';
import { SocketEvent } from 'src/shared/enums/socket.enum';
import { infoLog } from 'src/shared/utils/shared.util';

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private clients = new Map<string, string>();

    constructor(private jwtService: JwtService) {}

    handleConnection(client: Socket) {
        const token = client.handshake.auth.token;
        try {
            const decoded = this.jwtService.verify(token, {
                secret: envConfig.jwtSecret!,
            });
            const userId = decoded.sub;
            this.clients.set(userId, client.id);

            console.log(
                `[WEBSOCKET] 🟢 User ${userId} connected (socket: ${client.id})`,
            );
        } catch (err) {
            console.error('[WEBSOCKET] Invalid token:', err.message);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        for (const [uid, sid] of this.clients.entries()) {
            if (sid === client.id) this.clients.delete(uid);
        }
    }

    sendToUser(userId: string, payload: any) {
        const socketId = this.clients.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('notification', payload);
        }
    }

    isOnline(userId: string): boolean {
        return this.clients.has(userId);
    }

    emit(socketEvent: SocketEvent, payload: any) {
        this.server.emit(socketEvent, payload);

        infoLog(`SOCKET:${socketEvent}`, JSON.stringify(payload, null, 2));
    }
}
