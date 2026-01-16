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
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/role/role.enum';

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
    async findAll() {
        const announcements = await this.announcementsService.findAll();

        return {
            message: 'ดึงข้อมูลประกาศทั้งหมดเรียบร้อย',
            data: announcements,
        };
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.announcementsService.findOne(+id);
    }

    @Patch(':id')
    @Roles(Role.Admin)
    async update(
        @Param('id') id: string,
        @Body() updateAnnouncementDto: UpdateAnnouncementDto,
    ) {
        const announcement = await this.announcementsService.update(
            id,
            updateAnnouncementDto,
        );

        return {
            message: 'แก้ไขประกาศเรียบร้อย',
            data: announcement,
        };
    }

    @Delete(':id')
    @Roles(Role.Admin)
    async remove(@Param('id') id: string) {
        await this.announcementsService.remove(id);

        return {
            message: 'ลบประกาศเรียบร้อย',
        };
    }
}
