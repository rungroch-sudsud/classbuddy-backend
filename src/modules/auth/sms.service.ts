import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';


@Injectable()
export class SmsService {
    constructor(private http: HttpService) { }

    async sendOtp(phone: string, otp: string) {
        const response = await firstValueFrom(
            this.http.post(
                'https://api-v2.thaibulksms.com/sms',
                {
                    msisdn: phone,
                    message: `Your OTP is ${otp}`,
                },
                {
                    headers: {
                        Authorization: `Basic ${Buffer.from(
                            process.env.THAIBULKSMS_API_KEY +
                            ':' +
                            process.env.THAIBULKSMS_API_SECRET,
                        ).toString('base64')}`,
                    },
                },
            ),
        );
        return response.data;
    }
}
