import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { S3Service } from 'src/infra/s3/s3.service';
import { getErrorMessage } from 'src/shared/utils/shared.util';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';
import { BlackList } from './schemas/blacklist.schema';

@Injectable()
export class BlacklistsService {
    constructor(
        private readonly s3Service: S3Service,
        @InjectModel(BlackList.name) private blackListModel: Model<BlackList>,
        @InjectConnection() private readonly connection: Connection,
    ) {}

    private _getEvidenceFilePath(blackListId: string): string {
        const filePath = `blacklists/${blackListId}/evidences`;

        return filePath;
    }

    async create(
        createBlacklistDto: CreateBlacklistDto,
        evidences: Array<Express.Multer.File>,
    ) {
        if (evidences.length <= 0)
            throw new BadRequestException('กรุณาแนบรูปหลักฐานอย่างน้อย 1 รูป');

        const session = await this.connection.startSession();

        try {
            const { scammerUsername, platform } = createBlacklistDto;

            await session.withTransaction(async () => {
                const newBlackList = await this.blackListModel.insertOne(
                    {
                        scammerUsername,
                        platform,
                    },
                    { session },
                );

                const evidenceUrls = await Promise.all(
                    evidences.map((evidence) => {
                        const evidenceFilePath = this._getEvidenceFilePath(
                            newBlackList._id.toString(),
                        );

                        const evidenceUrl = this.s3Service.uploadPublicReadFile(
                            evidence,
                            evidenceFilePath,
                        );

                        return evidenceUrl;
                    }),
                );

                newBlackList.evidenceUrls = evidenceUrls;
                await newBlackList.save({ session });
            });

            return { message: 'สร้าง black list สำเร็จ', data: null };
        } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);

            throw new BadRequestException(errorMessage);
        } finally {
            await session.endSession();
        }
    }
}
