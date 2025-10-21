import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';




@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationService: NotificationsService
    ) { }


    @Get('mine')
    @UseGuards(JwtGuard)
    async getMySlots(@CurrentUser() userId: string) {
        const notific = await this.notificationService.getNotificationMine(userId);

        return {
            message: 'ดึงการแจ้งเตือนของฉันสำเร็จ',
            data: notific,
        };
    }


}
