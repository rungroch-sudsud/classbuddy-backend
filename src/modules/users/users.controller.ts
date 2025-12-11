import {
    Body,
    Controller,
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
import { UpdateProfileDto } from './schemas/user.zod.schema';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Patch('profile')
    @UseGuards(JwtGuard)
    @ApiBody({ type: UpdateProfileDto })
    async updateProfile(
        @CurrentUser() userId: string,
        @Body() body: UpdateProfileDto,
    ) {
        const user = await this.usersService.updateProfile(userId, body);

        return {
            message: 'อัพเดทข้อมูลของฉันสำเร็จ',
            data: user,
        };
    }

    @Post('profile/image')
    @ApiBody({ type: UploadFileDto })
    @ApiConsumes('multipart/form-data')
    @UseGuards(JwtGuard)
    @UploadInterceptor('file', 1, 5)
    async uploadProfileImage(
        @CurrentUser() userId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        console.log('hit controller');
        const update = await this.usersService.updateProfileImage(userId, file);

        return {
            message: 'อัพเดทรูปโปรไฟล์ของฉันสำเร็จ',
            data: update,
        };
    }

    @Get('mine')
    @UseGuards(JwtGuard)
    async getMe(@CurrentUser() userId: string) {
        const user = await this.usersService.getUserProfileMine(userId);

        return {
            message: 'ดึงโปรไฟล์ของฉันสำเร็จ',
            data: user,
        };
    }

    @Patch('bookmarks/:teacherId')
    @UseGuards(JwtGuard)
    async toggleBookmark(
        @CurrentUser() userId: string,
        @Param('teacherId') teacherId: string,
    ) {
        const booked = await this.usersService.toggleBookmark(
            userId,
            teacherId,
        );

        return {
            message: 'บันทึกข้อมูลเรียบร้อย',
            data: booked,
        };
    }
}
