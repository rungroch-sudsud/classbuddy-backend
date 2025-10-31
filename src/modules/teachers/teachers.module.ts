import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Teacher, TeacherSchema } from './schemas/teacher.schema';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { S3Module } from 'src/infra/s3/s3.module';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { ChatModule } from '../chat/chat.module';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Teacher.name, schema: TeacherSchema },
            { name: User.name, schema: UserSchema },
            { name: Slot.name, schema: SlotSchema },
        ]),
        S3Module,
        ChatModule
    ],
    providers: [TeachersService],
    controllers: [TeachersController],
    exports: [TeachersService, MongooseModule],
})

export class TeachersModule { }
