import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';

@ApiTags('Posts')
@Controller('posts')
@ApiBearerAuth()
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @Post()
    @ApiOperation({ summary: 'สร้างโพสสำหรับนักเรียนหาคุณครู' })
    @UseGuards(JwtGuard)
    createPost(
        @Body() createPostDto: CreatePostDto,
        @CurrentUser() userId: string,
    ) {
        return this.postsService.createPost(createPostDto, userId);
    }

    @Post('/:postId')
    @ApiOperation({ summary: 'สร้างคำเสนอของคุณครูให้กับโพสต์นักเรียน' })
    @UseGuards(JwtGuard)
    createProposal(
        @Body() createPostDto: CreatePostDto,
        @CurrentUser() userId: string,
        @Param('postId') postId: string,
    ) {
        return this.postsService.createProposal(createPostDto, userId, postId);
    }
}
