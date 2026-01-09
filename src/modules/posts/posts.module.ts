import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmsModule } from 'src/infra/sms/sms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post, PostSchema } from './schemas/post.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Post.name, schema: PostSchema },
            { name: Teacher.name, schema: TeacherSchema },
        ]),
        NotificationsModule,
        SmsModule,
    ],
    controllers: [PostsController],
    providers: [PostsService],
})
export class PostsModule {}
