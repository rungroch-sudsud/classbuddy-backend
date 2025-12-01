import {
    Body,
    Controller,
    HttpCode,
    Param,
    Post,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import { WebhookService } from './webhook.service';
import { SmsService } from 'src/infra/sms/sms.service';

@Controller('webhooks')
export class WebhookController {
    constructor(
        private readonly webHookService: WebhookService,
        private readonly smsService: SmsService,
        @InjectModel(User.name) private userModel: Model<User>,
    ) {}

    @Post('omise/:token')
    @HttpCode(200)
    async handleOmise(
        @Param('token') token: string,
        @Req() req: Request,
        @Body() body: any,
    ): Promise<{ received: boolean }> {
        const expected = process.env.OMISE_WEBHOOK_TOKEN;
        if (expected && token !== expected) {
            throw new UnauthorizedException(
                '[WebHook] Omise webhook Token ไม่ถูกต้อง',
            );
        }

        // const signature = req.headers['x-omise-signature'] as string;
        // const secret = process.env.OMISE_WEBHOOK_TOKEN;
        // const rawBody = JSON.stringify(body);
        // const computed = crypto
        //     .createHmac('sha256', secret!)
        //     .update(rawBody)
        //     .digest('hex');

        // if (signature !== computed) {
        //     throw new UnauthorizedException('[WebHook] Omise signature ไม่ถูกต้อง');
        // }

        await this.webHookService.handleOmiseWebhook(body);

        return { received: true };
    }

    @Post('get-stream')
    @HttpCode(200)
    async handleGetStream(
        @Body() body: Record<string, any>,
    ): Promise<{ received: boolean }> {
        const eventType: string = body.type;

        if (eventType === 'message.new') {
            const message: string = body.message.text;
            const senderUserId: User['_id'] = body.user.id;

            const receiver = body.members.find(
                (member) => member.user_id !== senderUserId,
            );

            const receiverUserId: string = receiver.user_id;

            const receiverInfo = await this.userModel
                .findById(receiverUserId)
                .lean();

            const receiverPhoneNumber: string | undefined = receiverInfo?.phone;

            const formattedMessage: string = `
            มีนักเรียนส่งข้อความถึงคุณ : ${message} \n
            คลิก : https://classbuddy.online/chat เพื่อดูรายละเอียด
            `;

            if (receiverPhoneNumber) {
                await this.smsService.sendSms(
                    receiverPhoneNumber,
                    formattedMessage,
                );
            }
        }

        return { received: true };
    }
}
