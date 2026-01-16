import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { S3Service } from 'src/infra/s3/s3.service';
import { errorLog, getErrorMessage } from 'src/shared/utils/shared.util';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Announcement } from './schemas/announcement.schema';

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

    async findAll(): Promise<Array<Announcement>> {
        try {
            const announcements: Array<Announcement> =
                await this.announcementModel
                    .find()
                    .sort({ order: 'asc' })
                    .lean<Array<Announcement>>();

            return announcements;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `ล้มเหลวระหว่างดึงข้อมูล announcements ทั้งหมด -> ${errorMessage}`,
            );

            throw error;
        }
    }

    findOne(id: number) {
        return `This action returns a #${id} announcement`;
    }

    async update(
        id: string,
        updateAnnouncementDto: UpdateAnnouncementDto,
    ): Promise<Announcement> {
        try {
            const existingAnnouncement =
                await this.announcementModel.findById(id);

            if (!existingAnnouncement) {
                throw new NotFoundException('ไม่พบประกาศที่ต้องการแก้ไข');
            }

            const updatedAnnouncement =
                await this.announcementModel.findByIdAndUpdate(
                    id,
                    { $set: updateAnnouncementDto },
                    { new: true },
                );

            if (!updatedAnnouncement) {
                throw new NotFoundException('ไม่พบประกาศที่ต้องการแก้ไข');
            }

            return updatedAnnouncement;
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `ล้มเหลวระหว่างแก้ไข announcement -> ${errorMessage}`,
            );

            throw error;
        }
    }

    async remove(id: string): Promise<void> {
        try {
            const announcement = await this.announcementModel.findById(id);

            if (!announcement) {
                throw new NotFoundException('ไม่พบประกาศที่ต้องการลบ');
            }

            await this.announcementModel.findByIdAndDelete(id);
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            errorLog(
                this.logEntity,
                `ล้มเหลวระหว่างลบ announcement -> ${errorMessage}`,
            );

            throw error;
        }
    }
}
