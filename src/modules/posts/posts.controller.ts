import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { JwtGuard } from '../auth/guard/auth.guard';
import {
    CreatePostDto,
    CreateProposalDto,
    UpdatePostDto,
    UpdateProposalDto,
} from './dto/post.dto';
import { PostsService } from './posts.service';

@ApiTags('Posts')
@Controller('posts')
@ApiBearerAuth()
export class PostsController {
    constructor(private readonly postsService: PostsService) {}

    @Post('')
    @ApiOperation({ summary: 'สร้างโพสสำหรับนักเรียนหาคุณครู' })
    @UseGuards(JwtGuard)
    create(
        @Body() createPostDto: CreatePostDto,
        @CurrentUser() userId: string,
    ) {
        return this.postsService.createPost(createPostDto, userId);
    }

    @Get('')
    async getAllPost(@Query('page') page: number = 1) {
        return this.postsService.getAll(page);
    }

    @Get('/:postId')
    async getPostById(@Param('postId') postId: string) {
        return this.postsService.getPostById(postId);
    }

    @Patch(':postId')
    @UseGuards(JwtGuard)
    async updatePost(
        @CurrentUser() userId: string,
        @Param('postId') postId: string,
        @Body() body: UpdatePostDto,
    ) {
        const update = await this.postsService.updatePost(userId, postId, body);

        return {
            message: 'อัพเดทโพสต์สำเร็จ',
            data: update,
        };
    }

    @Patch('close/:postId')
    @UseGuards(JwtGuard)
    async closePost(
        @CurrentUser() userId: string,
        @Param('postId') postId: string,
    ) {
        const update = await this.postsService.closePost(userId, postId);

        return {
            message: 'ปิดโพสต์สำเร็จ',
            data: update,
        };
    }

    @Delete(':postId')
    @UseGuards(JwtGuard)
    async deletePost(
        @CurrentUser() userId: string,
        @Param('postId') postId: string,
    ) {
        const result = await this.postsService.deletePost(userId, postId);

        return {
            message: 'ลบโพสต์สำเร็จ',
            date: result,
        };
    }

    @Post(':postId')
    @ApiOperation({ summary: 'ครูเสนอตัวเองในโพสต์' })
    @UseGuards(JwtGuard)
    async teacherResponsePost(
        @CurrentUser() userId: string,
        @Param('postId') postId: string,
        @Body() body: CreateProposalDto,
    ) {
        return this.postsService.addProposal(postId, userId, body);
    }

    @Delete(':postId/proposals')
    @ApiOperation({ summary: 'ครูลบข้อเสนอของตนเอง' })
    @UseGuards(JwtGuard)
    async deleteProposal(
        @CurrentUser() userId: string,
        @Param('postId') postId: string,
    ) {
        await this.postsService.deleteProposal(postId, userId);

        return {
            message: 'ลบข้อเสนอสำเร็จ',
        };
    }
}
