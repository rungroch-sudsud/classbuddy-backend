import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';import { S3Module } from 'src/infra/s3/s3.module';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { ChatModule } from '../chat/chat.module';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Wallet.name, schema: WalletSchema }
    ]),
    S3Module,
    ChatModule
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule { }
