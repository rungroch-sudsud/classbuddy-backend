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



@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService
  ) { }




  @Patch('profile')
  async updateProfile(
    @CurrentUser() userId: string,
    @Body() body: any
  ) {
    const user = await this.usersService.updateProfile(userId, body);

    return {
      message: 'User created successfully',
      data: user,
    };
  }

}
