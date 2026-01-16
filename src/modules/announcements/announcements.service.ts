import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import {
    Announcement,
    AnnouncementDocument,
} from './schemas/announcement.schema';
import { S3Service } from 'src/infra/s3/s3.service';
import { errorLog, getErrorMessage } from 'src/shared/utils/shared.util';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

@Injectable()
export class AnnouncementsService {
    private readonly logEntity = 'ANNOUNCEMENT SERVICE';

    constructor(
        @InjectConnection() private readonly connection: Connection,
        @InjectModel(Announcement.name)
        private readonly announcementModel: Model<Announcement>,
        private readonly s3Service: S3Service,
    ) {}

    async create(
        createAnnouncementDto: CreateAnnouncementDto,
        file: Express.Multer.File,
    ): Promise<Announcement> {
        const session = await this.connection.startSession();

        try {
            const createdAnnoncement = await session.withTransaction(
                async () => {
                    // 1 : สร้าง Announcement ใหม่
                    const existingAnnouncementCount: number =
                        await this.announcementModel
                            .countDocuments()
                            .session(session);

                    const newAnnouncementOrder: number =
                        existingAnnouncementCount + 1;

                    const newAnnouncement: Announcement =
                        await this.announcementModel.insertOne(
                            {
                                imageUrl: null,
                                externalUrl:
                                    createAnnouncementDto.externalUrl ?? null,
                                order: newAnnouncementOrder,
                            },
                            { session },
                        );

                    // 2 : อัปโหลดรูปภาพสำหรับ Announcement นี้
                    const newAnnouncementId: string =
                        newAnnouncement._id.toString();

                    const announcementImageUrl: string =
                        await this.s3Service.uploadPublicReadFile(
                            file,
                            `announcements/${newAnnouncementId}`,
                        );

                    // 3 : อัปเดตรูปภาพสำหรับ Announcement นี้
                    newAnnouncement.imageUrl = announcementImageUrl;
                    await newAnnouncement.save({ session });

                    return newAnnouncement;
                },
            );

            return createdAnnoncement;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `ล้มเหลวระหว่างสร้าง announcement -> ${errorMessage}`,
            );

            throw error;
        } finally {
            await session.endSession();
        }
    }

    findAll() {
        return `This action returns all announcements`;
    }

    findOne(id: number) {
        return `This action returns a #${id} announcement`;
    }

    update(id: number, updateAnnouncementDto: UpdateAnnouncementDto) {
        return `This action updates a #${id} announcement`;
    }

    remove(id: number) {
        return `This action removes a #${id} announcement`;
    }
}
