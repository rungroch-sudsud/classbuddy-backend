import { Body, Controller, Get, Post, UploadedFile, UseGuards } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guard/auth.guard';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { ImageFileSchema } from 'src/shared/validators/zod.schema';
import { ZodFilePipe } from 'src/shared/validators/zod.validation.pipe';
import { CreateSubjectDocs } from './docs/docs.subject';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/role/role.enum';



@ApiTags('Subject')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
    constructor(
        private readonly subjectListService: SubjectsService
    ) { }


    @Post('add')
    @ApiBody({ type: CreateSubjectDocs })
    @ApiConsumes('multipart/form-data')
    @UseGuards(JwtGuard, RolesGuard)
    @Roles(Role.Admin, Role.Moderator)
    @UploadInterceptor('file', 1, 5)
    async createSubject(
        @Body('name') name: string,
        @UploadedFile(new ZodFilePipe(ImageFileSchema)) file: Express.Multer.File,
    ) {
        const subject = await this.subjectListService.createSubject(name, file);

        return {
            message: 'เพิ่มวิชาใหม่เรียบร้อย',
            data: subject,
        };
    }
    

    @Get('teacher')
    async getAllSubject() {
        const getAll = await this.subjectListService.getAllSubject();

        return {
            message: 'ดึงข้อมูลวิชาทั้งหมดสำเร็จ',
            data: getAll,
        };
    }

}
