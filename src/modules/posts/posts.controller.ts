import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Posts')
@Controller('posts')
@ApiBearerAuth()
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @Post()
    @ApiOperation({ summary: 'สร้างโพสสำหรับนักเรียนหาคุณครู' })
    @UseGuards(JwtGuard)
    create(
        @Body() createPostDto: CreatePostDto,
        @CurrentUser() userId: string,
    ) {
        return this.postsService.createPost(createPostDto, userId);
    }
}
