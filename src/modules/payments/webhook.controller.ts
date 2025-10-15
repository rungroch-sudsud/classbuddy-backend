import { Controller, Post, Body, Param, HttpCode, UnauthorizedException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { WebhookService } from './webhook.service';


@Controller('webhooks')
export class WebhookController {
    constructor(
        private readonly webHookService: WebhookService,
    ) { }

    @Post('omise/:token')
    @HttpCode(200)
    async handleOmise(
        @Param('token') token: string,
        @Body() body: any,
    ) {
        const expected = process.env.OMISE_WEBHOOK_TOKEN;
        if (expected && token !== expected) {
            throw new UnauthorizedException('Invalid webhook token');
        }

        await this.webHookService.handleOmiseWebhook(body);

        return { received: true };
    }
}
