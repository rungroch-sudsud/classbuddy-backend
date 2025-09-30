import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from 'src/infra/sms/sms.service';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto } from './schemas/auth.zod.schema';



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
        body: RegisterDto
    ): Promise<any> {
        const { phone, password, confirmPassword } = body

        if (password !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        const exist = await this.userService.findByPhone(phone);
        if (exist) throw new BadRequestException('User already exists');

        const cooldownKey = `otp-cooldown:${phone}`;
        const hasCooldown = await this.redis.get(cooldownKey);
        if (hasCooldown) {
            throw new BadRequestException('Please wait before requesting another OTP');
        }
        await this.redis.setex(cooldownKey, 60, '1');

        const hashed = await bcrypt.hash(password, 10);
        const otp = this.generateOtp();

        const sessionId = uuidv4();

        await this.redis.setex(
            `otp-session:${sessionId}`,
            300,
            JSON.stringify({ phone, otp, hashed })
        );

        // const check = await this.redis.get(`otp-session:${sessionId}`);
        // console.log('Save OTP:', sessionId, otp);
        // console.log('Redis check:', check);

        await this.smsService.sendOtp(phone, otp);

        return { sessionId };
    }


    async verifyRegisterOtp({
        sessionId,
        otp,
    }: any
    ): Promise<any> {
        const sessionKey = `otp-session:${sessionId}`;
        const attemptKey = `otp-attempt:${sessionId}`;

        const data = await this.redis.get(`otp-session:${sessionId}`);
        if (!data) throw new BadRequestException('OTP expired or not found');

        const attempts = await this.redis.incr(attemptKey);
        if (attempts === 1) {
            await this.redis.expire(attemptKey, 300);
        }

        if (attempts > 3) {
            await this.redis.del(sessionKey);
            await this.redis.del(attemptKey);
            throw new BadRequestException('Too many invalid attempts, session expired');
        }

        const { phone, hashed, otp: storedOtp } = JSON.parse(data);
        if (storedOtp !== otp) throw new BadRequestException('Invalid OTP');

        const user = await this.userService.createProfile(
            phone,
            hashed
        );

        await this.redis.del(sessionKey);
        await this.redis.del(attemptKey);

        const payload = { sub: user._id.toString() };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken };
    }


    async login(
        body: any
    ): Promise<any> {
        const { phone, password } = body;

        const user = await this.userService.findByPhone(phone);
        if (!user) throw new BadRequestException('User not found');

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Password wrong');
        }

        const payload = { sub: user._id.toString() };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken };
    }





    
}
