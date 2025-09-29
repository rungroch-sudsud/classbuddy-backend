import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { SmsModule } from '../../infra/sms/sms.module';

@Module({
  imports: [
    UsersModule,
    SmsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES },  
    })
  ],
  providers: [AuthService],
  controllers: [AuthController],
})

export class AuthModule {}
