import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Module } from 'src/infra/s3/s3.module';
import { SmsService } from '../../infra/sms/sms.service';
import { ChatModule } from '../chat/chat.module';
import { PayoutLog, PayoutLogSchema } from '../payments/schemas/payout.schema';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Slot, SlotSchema } from '../slots/schemas/slot.schema';
import { SocketModule } from '../socket/socket.module';
import { SubjectList, SubjectSchema } from '../subjects/schemas/subject.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Teacher, TeacherSchema } from './schemas/teacher.schema';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';
import { HttpService } from '@nestjs/axios';
import { SmsModule } from 'src/infra/sms/sms.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Teacher.name, schema: TeacherSchema },
            { name: User.name, schema: UserSchema },
            { name: Slot.name, schema: SlotSchema },
            { name: SubjectList.name, schema: SubjectSchema },
            { name: Wallet.name, schema: WalletSchema },
            { name: PayoutLog.name, schema: PayoutLogSchema },
        ]),
        S3Module,
        ChatModule,
        SocketModule,
        SmsModule,
    ],
    providers: [TeachersService],
    controllers: [TeachersController],
    exports: [TeachersService, MongooseModule],
})
export class TeachersModule {}
