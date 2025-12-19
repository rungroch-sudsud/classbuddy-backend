import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from './schema/notification';
import { Teacher } from '../teachers/schemas/teacher.schema';
import { SocketService } from '../socket/socket.service';
import { expoNotificationClient } from 'src/infra/axios';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectModel(Notification.name)
        private notificationModel: Model<Notification>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
        private readonly gateway: SocketService,
    ) {}

    async getNotificationMine(userId: string): Promise<any> {
        const userObjId = new Types.ObjectId(userId);

        const teacher = await this.teacherModel
            .findOne({ userId: userObjId })
            .lean();

        const recipientIds: Types.ObjectId[] = [userObjId];
        if (teacher?._id) recipientIds.push(teacher._id);

        const notifications = await this.notificationModel
            .find({
                recipientId: { $in: recipientIds },
            })
            .sort({ createdAt: -1 })
            .lean();

        return notifications;
    }

    async testNotify(userId: string) {
        this.gateway.sendToUser(userId, {
            title: '📢 ทดสอบ Notification',
            message: `ระบบเชื่อมต่อเรียบร้อยแล้ว ${userId}`,
        });
        return { message: 'sent' };
    }

    async sendNotification(
        userId: string,
        payload: {
            recipientType: 'User' | 'Teacher';
            message: string;
            type: string;
            meta?: Record<string, any>;
        },
    ) {
        const newNoti = await this.notificationModel.create({
            recipientId: new Types.ObjectId(userId),
            recipientType: payload.recipientType,
            senderType: 'System',
            message: payload.message,
            type: payload.type,
            meta: payload.meta || {},
            isRead: false,
        });

        this.gateway.sendToUser(userId, {
            id: newNoti._id,
            message: payload.message,
            type: payload.type,
            meta: payload.meta,
            createdAt: new Date(),
        });

        return newNoti;
    }

    async notify({
        expoPushTokens,
        title,
        body,
        data,
    }: {
        expoPushTokens: Array<string> | string;
        title: string;
        body: string;
        data?: Record<string, any>;
    }) {
        let message: Record<string, any> = {};

        message = {
            to: expoPushTokens,
            sound: 'notification.wav',
            title,
            body,
            channelId: 'global',
        };

        if (data !== undefined) {
            message.data = data;
        }

        const headers = {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
        };

        await expoNotificationClient.post('/', message, {
            headers,
        });
    }
}
