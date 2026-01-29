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
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
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
    @ApiOperation({
        summary: 'ดึงรายชื่อคอร์สเรียนที่เปิดสอน (สำหรับนักเรียน)',
    })
    async getAvailableCourses() {
        devLog(this.logEntity, 'GET AVAILABLE COURSES -> RUNNING...');

        const courses = await this.coursesService.getAvailableCourses();

        return {
            message: 'ดึงข้อมูลคอร์สเรียนที่เปิดสอนสำเร็จ',
            data: courses,
        };
    }

    @Get('mine')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    async getMyCreatedCourses(@CurrentUser() userId: string) {
        devLog(this.logEntity, 'GET MY CREATED COURSES -> RUNNING...');

        const courses = await this.coursesService.getMyCreatedCourses(userId);

        return {
            message: 'ดึงข้อมูลคอร์สเรียนของฉันสำเร็จ',
            data: courses,
        };
    }

    @Get(':id')
    async findOne(@Param('id') courseId: string) {
        devLog(this.logEntity, 'FIND ONE COURSE -> RUNNING...');

        const course = await this.coursesService.findOne(courseId);

        devLog(this.logEntity, 'FIND ONE COURSE -> SUCCESS');

        return {
            message: 'ดึงข้อมูลคอร์สเรียนสำเร็จ',
            data: course,
        };
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtGuard)
    async update(
        @CurrentUser() userId: string,
        @Param('id') courseId: string,
        @Body() updateCourseDto: UpdateCourseDto,
    ) {
        devLog(this.logEntity, 'UPDATE COURSE -> RUNNING...');

        const updatedCourse = await this.coursesService.update(
            userId,
            courseId,
            updateCourseDto,
        );

        devLog(this.logEntity, 'UPDATE COURSE -> SUCCESS');

        return {
            message: 'อัปเดตคอร์สเรียนสำเร็จ',
            data: updatedCourse,
        };
    }

    @Patch(':id/image')
    @ApiBearerAuth()
    @ApiBody({ type: UploadFileDto })
    @ApiConsumes('multipart/form-data')
    @UseGuards(JwtGuard)
    @UploadInterceptor('courseImageFile', 1, 5)
    async upsertCourseImage(
        @CurrentUser() userId: string,
        @Param('id') courseId: string,
        @UploadedFile() courseImageFile: Express.Multer.File,
    ) {
        devLog(this.logEntity, 'UPSERT COURSE IMAGE --> RUNNING...');

        const data = await this.coursesService.updateCourseImage(
            userId,
            courseId,
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
    async remove(@CurrentUser() userId: string, @Param('id') courseId: string) {
        devLog(this.logEntity, 'REMOVE COURSE -> RUNNING...');

        const result = await this.coursesService.remove(userId, courseId);

        devLog(this.logEntity, 'REMOVE COURSE -> SUCCESS');

        return {
            message: 'ลบคอร์สเรียนสำเร็จ',
            data: result,
        };
    }
}
