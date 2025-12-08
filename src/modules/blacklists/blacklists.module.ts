import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Service } from 'src/infra/s3/s3.service';
import { BlacklistsController } from './blacklists.controller';
import { BlacklistsService } from './blacklists.service';
import { BlackList, BlackListSchema } from './schemas/blacklist.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: BlackList.name, schema: BlackListSchema },
        ]),
    ],
    controllers: [BlacklistsController],
    providers: [BlacklistsService, S3Service],
})
export class BlacklistsModule {}
