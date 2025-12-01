import {
    Body,
    Controller,
    HttpCode,
    Param,
    Post,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
    constructor(private readonly webHookService: WebhookService) {}

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
        await this.webHookService.handleGetStreamWebhook(body);

        return { received: true };
    }
}
