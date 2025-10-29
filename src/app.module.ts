import { WebhookService } from './modules/payments/webhook.service';
import { WebhookController } from './modules/payments/webhook.controller';
import { S3Module } from './infra/s3/s3.module';
import { RedisModule } from './infra/redis/redis.module';
import { SmsModule } from './infra/sms/sms.module';
import { Module } from '@nestjs/common';
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
import { BookingController } from './modules/booking/booking.controller';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentsController } from './modules/payments/payments.controller';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';



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
    PaymentsModule,
    NotificationsModule,
    AdminModule,
    ChatModule,
  ],
  controllers: [
    WebhookController,
    AppController,
    SubjectsController,
    TeachersController,
    BookingController,
    PaymentsController,
    NotificationsController,

  ],
  providers: [
    WebhookService, AppService],
  exports: [],
})

export class AppModule { }
