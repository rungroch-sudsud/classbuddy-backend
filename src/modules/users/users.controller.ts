import {
  Body,
  Param,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpStatus,
  Query,
  Req,
  Res,
  Request,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CreateTeacherProfileDto, UpdateProfileDto } from './schemas/user.zod.schema';
import { FileInterceptor } from '@nestjs/platform-express';



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
      message: 'User created successfully',
      data: user,
    };
  }

  @Post('profile/upload-image')
  @UseGuards(JwtGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const update = await this.usersService.updateProfileImage(userId, file);

    return {
      message: 'Update profile successfully',
      data: update,
    };
  }



  @Post('teacher/profile')
  @UseGuards(JwtGuard)
  @ApiBody({ type: CreateTeacherProfileDto })
  async createTeacherProfile(
    @CurrentUser() userId: string,
    @Body() body: CreateTeacherProfileDto,
  ) {
    const teacher = await this.usersService.createTeachProfile(userId, body);

    return {
      message: 'Teacher profile created successfully',
      data: teacher,
    };
  }


  @Get('teacher')
  async getAllTeachers(): Promise<any[]> {
    return this.usersService.findAll();
  }

}
