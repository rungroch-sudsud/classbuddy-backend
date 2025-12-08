import { Body, Controller, Post, UploadedFiles } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { FilesSchema } from 'src/shared/validators/zod.schema';
import { ZodFilesPipe } from 'src/shared/validators/zod.validation.pipe';
import { BlacklistsService } from './blacklists.service';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';

@Controller('blacklists')
@ApiTags('Black List')
export class BlacklistsController {
    constructor(private readonly blacklistsService: BlacklistsService) {}

    @Post()
    @UploadInterceptor('evidences', 3, 10, ['image'])
    @ApiConsumes('multipart/form-data')
    create(
        @Body() createBlacklistDto: CreateBlacklistDto,
        @UploadedFiles(new ZodFilesPipe(FilesSchema))
        evidences: Express.Multer.File[],
    ) {
        return this.blacklistsService.create(createBlacklistDto, evidences);
    }
}
