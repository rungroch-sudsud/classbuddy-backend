import { Controller, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { VideoService } from './video.service';



@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
    constructor(
        private readonly chat: ChatService,
        private readonly videoService: VideoService
    ) { }


    @Post('token')
    @UseGuards(JwtGuard)
    async issueToken(@CurrentUser() userId: any) {

        const userToken = await this.chat.bootstrapUserAndIssueToken(userId);
        return {
            message: 'token ของคุณคือ',
            data: userToken
        }
    }


    @Post('teacher/:teacherId')
    @UseGuards(JwtGuard)
    async createOrGetTeacherChannel(
        @Param('teacherId') teacherId: string,
        @CurrentUser() userId: string,
    ) {
        const channel = await this.chat.createOrGetChannel(
            userId,
            teacherId,
        );

        return {
            message: 'สร้างหรือดึงห้องแชทสำเร็จ',
            data: {
                channelId: channel.id,
                cid: channel.cid,
                // members: [studentId, teacherId],
                // token: this.streamChatService.createUserToken(studentId),
            },
        };
    }


}
