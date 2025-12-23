import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Module } from 'src/infra/s3/s3.module';
import { SmsModule } from 'src/infra/sms/sms.module';
import { ChatModule } from '../chat/chat.module';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Teacher.name, schema: TeacherSchema },
            { name: Wallet.name, schema: WalletSchema },
        ]),
        S3Module,
        ChatModule,
        SmsModule,
    ],
    providers: [UsersService],
    controllers: [UsersController],
    exports: [UsersService, MongooseModule],
})
export class UsersModule {}
