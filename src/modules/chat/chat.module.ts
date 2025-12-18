import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../booking/schemas/booking.schema';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { StreamChatService } from './stream-chat.service';
import { VideoService } from './video.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: Booking.name, schema: BookingSchema },
            { name: Slot.name, schema: SlotSchema },
        ]),
    ],
    controllers: [ChatController],
    providers: [ChatService, StreamChatService, VideoService],
    exports: [StreamChatService, ChatService, VideoService],
})
export class ChatModule {}
