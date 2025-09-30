import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';

@Injectable()
export class SmsService {
    constructor(private http: HttpService) { }

    async sendOtp(phone: string, otp: string) {
        try {
      const response = await firstValueFrom(
        this.http.post(
          'https://rest.moceanapi.com/rest/2/sms',
          qs.stringify({
            'mocean-to': phone,
            'mocean-from': 'Class-Buddy',       // Sender ID (ต้องอนุมัติ)
            'mocean-text': `Your OTP is ${otp}`,
          }),
          {
            headers: {
              Authorization: `Bearer ${process.env.MOCEAN_API_TOKEN}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );
      return response.data;
        } catch (err) {
            throw new BadRequestException(
                err.response?.data || 'Failed to send SMS',
            );
        }
    }
}
