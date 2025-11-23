import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { SmsModule } from '../../infra/sms/sms.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ChatModule } from '../chat/chat.module';
import { EmailModule } from 'src/infra/email/email.module';


@Module({
  imports: [
    UsersModule,
    SmsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES') || '1h' },
      }),
    }),
    ChatModule,
    EmailModule
  ],

  providers: [AuthService, JwtStrategy ],
  controllers: [AuthController],
  exports: [JwtModule]
})

export class AuthModule { }
