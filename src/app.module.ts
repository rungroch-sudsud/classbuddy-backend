import { S3Module } from './infra/s3/s3.module';
import { RedisModule } from './infra/redis/redis.module';
import { SmsModule } from './infra/sms/sms.module';
import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MongoDbModule } from './infra/database/connection';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SubjectsController } from './modules/subjects/subjects.controller';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { TeachersController } from './modules/teachers/teachers.controller';
import { SlotsModule } from './modules/slots/slots.module';
import { BookingService } from './modules/booking/booking.service';
import { BookingController } from './modules/booking/booking.controller';
import { BookingModule } from './modules/booking/booking.module';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    S3Module,
    MongoDbModule,
    RedisModule,
    SmsModule,
    UsersModule,
    AuthModule,
    SubjectsModule,
    TeachersModule,
    SlotsModule,
    BookingModule,
  ],
  controllers: [
    AppController,
    SubjectsController,
    TeachersController,
    BookingController,
    
  ],
  providers: [AppService],
  exports: [],
})

export class AppModule { }
