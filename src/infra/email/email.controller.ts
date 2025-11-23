// email-test.controller.ts
import { Controller, Get, Post } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplateID } from './email.type';

@Controller('email-test')
export class EmailTestController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async testSend() {
    return this.emailService.sendEmail({
      template_uuid: EmailTemplateID.SUCCESSFUL_PAYMENT,
      mail_to: { email: 'petunda.paksa@gmail.com' },
      subject: 'Test Email',
      payload: {
        name: 'Codeine',
      },
    });
  }
}
