import {
  Body,
  Param,
  Controller,
  Get,
  Post,
  Patch,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { UpdateProfileDto } from './schemas/user.zod.schema';
import { ZodFilePipe } from 'src/shared/validators/zod.validation.pipe';
import { UploadInterceptor } from 'src/shared/interceptors/upload.interceptor';
import { ImageFileSchema } from 'src/shared/validators/zod.schema';
import { UploadFileDto } from 'src/shared/docs/upload.file.docs';


@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService
  ) { }


  @Patch('profile')
  @UseGuards(JwtGuard)
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(
    @CurrentUser() userId: string,
    @Body() body: UpdateProfileDto
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
    @UploadedFile(new ZodFilePipe(ImageFileSchema)) file: Express.Multer.File,
  ) {
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


  @Patch('bookmarks/:slotId')
  @UseGuards(JwtGuard)
  async toggleBookmark(
    @CurrentUser() userId: string,
    @Param('slotId') slotId: string,
  ) {
    const booked = await this.usersService.toggleBookmark(userId, slotId);

    return {
      message: 'บันทึกข้อมูลเรียบร้อย',
      data: booked,
    };
  }

}
