import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from './sms.service';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';


@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UsersService,
        private readonly jwtService: JwtService,
        private readonly smsService: SmsService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) { }

    private generateOtp(length = 6): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async register(
        phone: string,
        password: string,
        confirmPassword: string
    ): Promise<any> {
        if (password !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        const exist = await this.userService.findByPhone(phone);
        if (exist) throw new BadRequestException('User already exists');

        const hashed = await bcrypt.hash(password, 10);
        const otp = this.generateOtp();

        await this.redis.setex(`otp:${phone}`, 300, JSON.stringify({ otp, hashed }));

        await this.smsService.sendOtp(phone, otp);

        return { phone, message: 'OTP sent, please verify' };
    }


    async verifyRegisterOtp(
        phone: string,
        otp: string,
        password: string
    ):Promise<any> {
        const data = await this.redis.get(`otp:${phone}`);
        if (!data) throw new BadRequestException('OTP expired or not found');

        const { otp: storedOtp, hashed } = JSON.parse(data);
        if (storedOtp !== otp) throw new BadRequestException('Invalid OTP');

        const user = await this.userService.create({ 
            phone, 
            passwordHash: hashed 
        });
        await this.redis.del(`otp:register:${phone}`);

        return { message: 'Register success' };
    }
}
