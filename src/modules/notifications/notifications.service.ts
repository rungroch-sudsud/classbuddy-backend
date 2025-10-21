import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification } from './schema/notification';
import { Teacher } from '../teachers/schemas/teacher.schema';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectModel(Notification.name) private notificationModel: Model<Notification>,
        @InjectModel(Teacher.name) private teacherModel: Model<Teacher>
    ) { }


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


}
