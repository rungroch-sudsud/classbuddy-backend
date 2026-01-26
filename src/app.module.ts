import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongoDbModule } from './infra/database/connection';
import { EmailTestController } from './infra/email/email.controller';
import { EmailModule } from './infra/email/email.module';
import { EmailService } from './infra/email/email.service';
import { RedisModule } from './infra/redis/redis.module';
import { S3Module } from './infra/s3/s3.module';
import { SmsModule } from './infra/sms/sms.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingController } from './modules/booking/booking.controller';
import { BookingModule } from './modules/booking/booking.module';
import { ChatModule } from './modules/chat/chat.module';
import { VideoService } from './modules/chat/video.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WebhookController } from './modules/payments/webhook.controller';
import { WebhookService } from './modules/payments/webhook.service';
import { PostsModule } from './modules/posts/posts.module';
import { SlotsModule } from './modules/slots/slots.module';
import { SocketModule } from './modules/socket/socket.module';
import { SubjectrequestsModule } from './modules/subjectrequests/subjectrequests.module';
import { SubjectsController } from './modules/subjects/subjects.controller';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TeachersController } from './modules/teachers/teachers.controller';
import { TeachersModule } from './modules/teachers/teachers.module';
import { UsersModule } from './modules/users/users.module';
import { CoursesModule } from './modules/courses/courses.module';

@Module({
    imports: [
        EmailModule,
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
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
        SocketModule,
        PostsModule,
        SubjectrequestsModule,
        EmailModule,
        CoursesModule,
    ],
    controllers: [
        WebhookController,
        AppController,
        SubjectsController,
        TeachersController,
        BookingController,
        NotificationsController,
        EmailTestController,
    ],
    providers: [VideoService, EmailService, WebhookService, AppService],
    exports: [],
})
export class AppModule {}
