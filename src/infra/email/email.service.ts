import { BadRequestException, Injectable } from '@nestjs/common';
import { envConfig } from 'src/configs/env.config';
import { errorLog, getErrorMessage } from 'src/shared/utils/shared.util';
import { thaiBulkEmailClient } from '../axios';
import { SendEmailPayload } from './email.type';

@Injectable()
export class EmailService {
    private readonly senderName: string = envConfig.thaiBulk.emailSenderName!;
    private readonly logEntity: string = 'EMAIL';

    async sendEmail(sendEmailPayload: Omit<SendEmailPayload, 'mail_from'>) {
        try {
            const formattedSendEmailPayload: SendEmailPayload = {
                ...sendEmailPayload,
                mail_from: { email: this.senderName },
            };

            const response = await thaiBulkEmailClient.post(
                '/send_template',
                formattedSendEmailPayload,
            );

            return response.data;
        } catch (err: unknown) {
            const errorMessage = getErrorMessage(err);

            errorLog(
                this.logEntity,
                `ล้มเหลวระหว่างส่ง E-mail ${JSON.stringify(errorMessage, null, 2)}`,
            );

            throw new BadRequestException('ล้มเหลวระหว่างส่ง E-mail');
        }
    }
}
