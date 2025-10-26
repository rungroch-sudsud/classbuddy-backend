import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { CreateTeacherProfileDto, reviewTeacherDto, UpdateTeacherDto } from './schemas/teacher.zod.schema';
import { TeachersService } from './teachers.service';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { ZodFilePipe, ZodFilesPipe } from 'src/shared/validators/zod.validation.pipe';
import { UploadFileDto, UploadFilesDto } from 'src/shared/docs/upload.file.docs';
import { FilesSchema, ImageFileSchema } from 'src/shared/validators/zod.schema';


@ApiTags('Teachers')
@ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
    constructor(
        private readonly teacherService: TeachersService
    ) { }


    @Post('')
    @ApiBody({ type: CreateTeacherProfileDto })
    @UseGuards(JwtGuard)
    async createTeacherProfile(
        @CurrentUser() userId: string,
        @Body() body: CreateTeacherProfileDto,
    ) {
        const teacher = await this.teacherService.createTeacherProfile(userId, body);

        return {
            message: 'Teacher profile created successfully',
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
        @UploadedFile(new ZodFilePipe(ImageFileSchema)) file: Express.Multer.File,
    ) {
        const update = await this.teacherService.updateIdCardWithPerson(userId, file);

        return {
            message: 'Update successfully',
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
        @UploadedFiles(new ZodFilesPipe(FilesSchema)) files: Express.Multer.File[],
    ) {
        const update = await this.teacherService.updateCertificate(userId, files);

        return {
            message: 'Update certificate successfully',
            data: update,
        };
    }


    @Get('all')
    async getAllTeachers() {
        const getAll = await this.teacherService.getAllTeacher();
        return {
            message: 'ดึงข้อมูลคุณครูทั้งหมด',
            data: getAll,
        };
    }


    @Get('')
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: 'คำค้นหา (เช่น ชื่อ, ทักษะ, วิชา)'
    })
    @ApiQuery({
        name: 'sort',
        required: false,
        enum: ['rating', 'priceAsc', 'priceDesc'],
        description: '(รวมเรียงราคาน้อย→มาก / มาก→น้อย)'
    })
    async getTeachersDefault(
        @Query('search') search?: string,
        @Query('sort') sort?: 'rating' | 'priceAsc' | 'priceDesc',
        @Query('page') page = '1',
        @Query('limit') limit = '10',
    ) {
        return this.teacherService.getTeachers(
            search,
            sort,
            parseInt(page, 10),
            parseInt(limit, 10),
        );
    }


    @Get('mine')
    @UseGuards(JwtGuard)
    async getMe(@CurrentUser() userId: string) {
        const find = await this.teacherService.getTeacherProfileMine(userId);

        return {
            message: 'ดึงโปรไฟล์ของฉันสำเร็จ',
            data: find,
        };
    }


    @Get(':teacherId')
    async getTeacherById(@Param('teacherId') teacherId: string) {
        const find = await this.teacherService.getTeacherProfileById(teacherId);

        return {
            message: 'ดึงโปรไฟล์ครูสำเร็จ',
            data: find,
        };
    }


    @Patch('profile')
    @ApiBody({ type: UpdateTeacherDto })
    @UseGuards(JwtGuard)
    async updateTeacherProfile(
        @CurrentUser() userId: string,
        @Body() body: any,
    ) {
        const updated = await this.teacherService.updateTeacherProfile(
            userId,
            body
        );

        return {
            message: 'อัพเดทข้อมูลผู้ใช้สำเร็จ',
            data: updated,
        };
    }



    //Review Section
    @Post('review/:teacherId')
    @ApiBody({ type: reviewTeacherDto })
    @UseGuards(JwtGuard)
    async addReview(
        @Param('teacherId') teacherId: string,
        @CurrentUser() reviewerId: string,
        @Body() body: any,
    ) {
        const review = await this.teacherService.addReview(teacherId, reviewerId, body);
        return {
            message: 'รีวิวครูคนนี้สำเร็จ',
            data: review,
        };
    }


}
