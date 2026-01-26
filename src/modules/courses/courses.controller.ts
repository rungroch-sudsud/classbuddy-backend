import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UploadedFile,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UploadFileDto } from 'src/shared/docs/upload.file.docs';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { devLog } from 'src/shared/utils/shared.util';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
    private readonly logEntity: string = 'COURSE CONTROLLER';

    constructor(private readonly coursesService: CoursesService) {}

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    async create(
        @CurrentUser() userId: string,
        @Body() createCourseDto: CreateCourseDto,
    ) {
        const createdCourse = await this.coursesService.create(
            userId,
            createCourseDto,
        );

        return {
            message: 'สร้างคอร์สเรียนสำเร็จ',
            data: createdCourse,
        };
    }

    @Get()
    findAll() {
        return this.coursesService.findAll();
    }

    @Get('mine')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    async getMyCreatedCourses(@CurrentUser() userId: string) {
        const courses = await this.coursesService.getMyCreatedCourses(userId);

        return {
            message: 'ดึงข้อมูลคอร์สเรียนของฉันสำเร็จ',
            data: courses,
        };
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    update(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @Body() updateCourseDto: UpdateCourseDto,
    ) {
        return this.coursesService.update(userId, id, updateCourseDto);
    }

    @Patch(':id/image')
    @ApiBearerAuth()
    @ApiBody({ type: UploadFileDto })
    @ApiConsumes('multipart/form-data')
    @UseGuards(JwtGuard)
    @UploadInterceptor('courseImageFile', 1, 5)
    async upsertCourseImage(
        @CurrentUser() userId: string,
        @Param('id') id: string,
        @UploadedFile() courseImageFile: Express.Multer.File,
    ) {
        devLog(this.logEntity, 'UPSERT COURSE IMAGE --> RUNNING...');

        const data = await this.coursesService.updateCourseImage(
            userId,
            id,
            courseImageFile,
        );

        return {
            message: 'อัปโหลดรูปคอร์สเรียนสำเร็จ',
            data,
        };
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    remove(@CurrentUser() userId: string, @Param('id') id: string) {
        return this.coursesService.remove(userId, id);
    }
}
