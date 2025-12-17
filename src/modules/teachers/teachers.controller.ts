import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UploadedFiles,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import {
    UploadFileDto,
    UploadFilesDto,
} from 'src/shared/docs/upload.file.docs';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import {
    CreateTeacherProfileDto,
    UpdateTeacherDto,
} from './dto/teacher.dto.zod';
import { TeachersService } from './teachers.service';

@ApiTags('Teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
    constructor(private readonly teacherService: TeachersService) {}

    @Get('')
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: 'คำค้นหา (เช่น ชื่อ, ทักษะ, วิชา)',
    })
    @ApiQuery({
        name: 'sort',
        required: false,
        enum: ['rating', 'priceAsc', 'priceDesc'],
        description: '(รวมเรียงราคาน้อย→มาก / มาก→น้อย)',
    })
    async getTeachersDefault(
        @Query('search') search?: string,
        @Query('sort') sort?: 'rating' | 'priceAsc' | 'priceDesc',
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.teacherService.getTeachers(
            search,
            sort,
            parseInt(page, 10),
            parseInt(limit, 10),
        );
    }

    @Get('all')
    @ApiOperation({ summary: 'ดึงครูทั้งหมด สำหรับแอดมิน' })
    async getAllTeachers() {
        const getAll = await this.teacherService.getAllTeacher();
        return {
            message: 'ดึงข้อมูลคุณครูทั้งหมด',
            data: getAll,
        };
    }

    @Get('mine')
    @UseGuards(JwtGuard)
    async getMe(@CurrentUser() userId: string) {
        const find = await this.teacherService.getTeacherProfileMine(userId);

        return {
            message: 'แสดงโปรไฟล์ของฉันสำเร็จ',
            data: find,
        };
    }

    @Get(':teacherId')
    async getTeacherById(@Param('teacherId') teacherId: string) {
        const find = await this.teacherService.getTeacherProfileById(teacherId);

        return {
            message: 'แสดงโปรไฟล์ครูสำเร็จ',
            data: find,
        };
    }

    @Post('')
    @UseGuards(JwtGuard)
    async createTeacherProfile(
        @CurrentUser() userId: string,
        @Body() body: CreateTeacherProfileDto,
    ) {
        const teacher = await this.teacherService.createTeacherProfile(
            userId,
            body,
        );

        return {
            message: 'สร้างบัญชีผู้ใช้สำหรับครูสำเร็จ',
            data: teacher,
        };
    }

    @Post('profile/id-card-with-person')
    @ApiBody({ type: UploadFileDto })
    @ApiConsumes('multipart/form-data')
    @UseGuards(JwtGuard)
    @UploadInterceptor('file', 1, 10)
    async uploadIdCardWithPersonImage(
        @CurrentUser() userId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const update = await this.teacherService.updateIdCardWithPerson(
            userId,
            file,
        );

        return {
            message: 'อัพเดทข้อมูลสำเร็จ',
            data: update,
        };
    }

    @Post('profile/certificate')
    @ApiBody({ type: UploadFilesDto })
    @ApiConsumes('multipart/form-data')
    @UseGuards(JwtGuard)
    @UploadInterceptor('files', 3, 10, ['image', 'pdf'])
    async uploadCertificate(
        @CurrentUser() userId: string,
        @UploadedFiles()
        files: Express.Multer.File[],
    ) {
        const update = await this.teacherService.updateCertificate(
            userId,
            files,
        );

        return {
            message: 'อัพเดทข้อมูลสำเร็จ',
            data: update,
        };
    }

    @Patch('profile')
    @UseGuards(JwtGuard)
    async updateTeacherProfile(
        @CurrentUser() userId: string,
        @Body() body: UpdateTeacherDto,
    ) {
        const updated = await this.teacherService.updateTeacherProfile(
            userId,
            body,
        );

        return {
            message: 'อัพเดทข้อมูลผู้ใช้สำเร็จ',
            data: updated,
        };
    }

    //Review Section
    @Post('review/:teacherId')
    @ApiOperation({ summary: 'นักเรียนที่เคยเรียนรีวิวครู' })
    @UseGuards(JwtGuard)
    async addReview(
        @Param('teacherId') teacherId: string,
        @CurrentUser() reviewerId: string,
        @Body() body: any,
    ) {
        const review = await this.teacherService.addReview(
            teacherId,
            reviewerId,
            body,
        );

        return {
            message: 'รีวิวครูคนนี้สำเร็จ',
            data: review,
        };
    }

    @Delete('review/:teacherId')
    @UseGuards(JwtGuard)
    async deleteReview(
        @Param('teacherId') teacherId: string,
        @CurrentUser() userId: string,
    ) {
        await this.teacherService.deleteReview(teacherId, userId);

        return {
            message: 'ลบรีวิวเรียบร้อยแล้ว',
            data: null,
        };
    }

    //Payment Section
    @Get('payment/history')
    @UseGuards(JwtGuard)
    async getPaymentHistory(
        @CurrentUser() userId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const result = await this.teacherService.getPaymentHistory(
            userId,
            startDate,
            endDate,
        );

        return {
            message: 'แสดงรายได้ของฉันสำเร็จ',
            data: result,
        };
    }
}
