import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { StreamChatService } from './stream-chat.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';

@Module({
    imports: [
      MongooseModule.forFeature([
        { name: User.name, schema: UserSchema },
        { name: Teacher.name, schema: TeacherSchema }
      ]),
    ],
  controllers: [ChatController],
  providers: [ChatService, StreamChatService],
  exports: [StreamChatService, ChatService],
})
export class ChatModule {}
