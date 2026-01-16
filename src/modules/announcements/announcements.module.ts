import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
    Announcement,
    AnnouncementSchema,
} from './schemas/announcement.schema';
import { S3Module } from 'src/infra/s3/s3.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Announcement.name, schema: AnnouncementSchema },
        ]),
        S3Module,
    ],
    controllers: [AnnouncementsController],
    providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
