import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UploadedFile,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';

@Controller('announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) {}

    @Post()
    @UploadInterceptor('announcementImageFile', 1, 10)
    async create(
        @Body() createAnnouncementDto: CreateAnnouncementDto,
        @UploadedFile() announcementImageFile: Express.Multer.File,
    ) {
        const announcement = await this.announcementsService.create(
            createAnnouncementDto,
            announcementImageFile,
        );

        return {
            message: 'สร้างประกาศเรียบร้อย',
            data: announcement,
        };
    }

    @Get()
    findAll() {
        return this.announcementsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.announcementsService.findOne(+id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    ) {
        return this.announcementsService.update(+id, updateAnnouncementDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.announcementsService.remove(+id);
    }
}
