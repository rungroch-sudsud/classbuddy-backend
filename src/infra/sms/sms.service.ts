import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';

@Injectable()
export class SmsService {
    constructor(private http: HttpService) {}

    async sendOtp(phone: string, otp: string, refCode: string) {
        try {
            const body = qs.stringify({
                msisdn: phone, // เบอร์ปลายทาง
                sender: 'ClassBuddy', // ใช้ sender ที่อนุมัติแล้ว
                message: `รหัสยืนยันของคุณคือ ${otp}              กรุณาอย่าเปิดเผยรหัสนี้กับผู้อื่น 
รหัสอ้างอิง: ${refCode}`,
            });

            const auth = Buffer.from(
                `${process.env.THAIBULKSMS_API_KEY}:${process.env.THAIBULKSMS_API_SECRET}`,
            ).toString('base64');

            const response = await firstValueFrom(
                this.http.post('https://api-v2.thaibulksms.com/sms', body, {
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/x-www-form-urlencoded',
                        Authorization: `Basic ${auth}`,
                    },
                }),
            );

            return response.data;
        } catch (err) {
            throw new BadRequestException(
                err.response?.data || 'Failed to send SMS',
            );
        }
    }

    private _formatPhoneNumbers(phoneNumbers: string | Array<string>): string {
        const formattedPhones: string = Array.isArray(phoneNumbers)
            ? phoneNumbers.join(',')
            : phoneNumbers;

        return formattedPhones;
    }

    async sendSms(phones: string | string[], message: string) {
        try {
            const formattedPhones = this._formatPhoneNumbers(phones);

            const body = qs.stringify({
                msisdn: formattedPhones, // เบอร์ปลายทาง
                sender: 'ClassBuddy', // ใช้ sender ที่อนุมัติแล้ว
                message,
            });

            const auth = Buffer.from(
                `${process.env.THAIBULKSMS_API_KEY}:${process.env.THAIBULKSMS_API_SECRET}`,
            ).toString('base64');

            const response = await firstValueFrom(
                this.http.post('https://api-v2.thaibulksms.com/sms', body, {
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/x-www-form-urlencoded',
                        Authorization: `Basic ${auth}`,
                    },
                }),
            );

            return response.data;
        } catch (err) {
            throw new BadRequestException(
                err.response?.data || 'Failed to send SMS',
            );
        }
    }
}
