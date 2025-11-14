import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Notification, NotificationSchema } from '../notifications/schema/notification';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Teacher.name, schema: TeacherSchema },
      { name: Notification.name, schema: NotificationSchema }
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule { }
