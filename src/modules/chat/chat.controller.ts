import { Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';



@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
    constructor(private readonly chat: ChatService) { }

    @Post('token')
    @UseGuards(JwtGuard)
    async issueToken(@CurrentUser() userId: any) {
   
        const { userToken, teacherToken } = await this.chat.bootstrapUserAndIssueToken(userId);

        return { userToken, teacherToken };
    }


}
