import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from 'src/infra/sms/sms.service';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { ChangePasswordDto, RegisterDto } from './schemas/auth.zod.schema';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Model } from 'mongoose';



@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UsersService,
        private readonly jwtService: JwtService,
        private readonly smsService: SmsService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    private generateOtp(length = 6): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private generateRefCode(length = 6): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async register(
        body: RegisterDto
    ): Promise<{ sessionId: string }> {
        const { phone, password, confirmPassword } = body

        if (password !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        const exist = await this.userService.findByPhone(phone);
        if (exist) throw new BadRequestException('มีผู้ใช้เบอร์นี้อยู่ในระบบอยู่แล้ว');

        const cooldownKey = `otp-cooldown:${phone}`;
        const hasCooldown = await this.redis.get(cooldownKey);
        if (hasCooldown) {
            throw new BadRequestException('ระบบได้ส่งรหัสยืนยัน (OTP) ไปยังหมายเลขของคุณแล้ว ');
        }

        await this.redis.setex(cooldownKey, 60, 'cooldown');

        const hashed = await bcrypt.hash(password, 10);
        const otp = this.generateOtp();
        const refCode = this.generateRefCode();

        const sessionId = uuidv4();

        await this.redis.setex(
            `otp-session:${sessionId}`,
            1800,
            JSON.stringify({ phone, otp, hashed, refCode, otpCreatedAt: Date.now() })
        );

        // const check = await this.redis.get(`otp-session:${sessionId}`);
        // console.log('Save OTP:', sessionId, otp);
        // console.log('Redis check:', check);

        await this.smsService.sendOtp(phone, otp, refCode);

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

        const { phone, hashed, otp: storedOtp, otpCreatedAt } = JSON.parse(data);

        const now = Date.now();
        const otpLifetime = 5 * 60 * 1000;
        if (!otpCreatedAt || now - otpCreatedAt > otpLifetime) {
            await this.redis.del(sessionKey);
            await this.redis.del(attemptKey);
            throw new BadRequestException('OTP has expired, please request a new one');
        }

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
    ): Promise<{ accessToken: string }> {
        const { phone, password } = body;

        const user = await this.userService.findByPhone(phone);
        if (!user) throw new BadRequestException('User not found');

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Password wrong');
        }

        const payload = {
            sub: user._id.toString(),
            role: user.role,
        };

        const accessToken = this.jwtService.sign(payload);

        return { accessToken };
    }


    async resendOtp(sessionId: string) {
        const key = `otp-session:${sessionId}`;
        const cooldownKey = `otp-resend-cooldown:${sessionId}`;

        const hasCooldown = await this.redis.get(cooldownKey);
        if (hasCooldown) {
            throw new BadRequestException('กรุณารอสักครู่ก่อนขอรหัสใหม่อีกครั้ง');
        }

        const sessionRaw = await this.redis.get(key);
        const ttl = await this.redis.ttl(key);

        if (!sessionRaw || ttl <= 0) {
            throw new BadRequestException('Session หมดอายุแล้ว กรุณาสมัครใหม่');
        }

        const sessionData = JSON.parse(sessionRaw);
        const newOtp = this.generateOtp();
        const newRefCode = this.generateRefCode();

        await this.redis.setex(
            key,
            ttl,
            JSON.stringify({
                ...sessionData,
                otp: newOtp,
                refCode: newRefCode,
                otpCreatedAt: Date.now(),
            })
        );

        await this.redis.setex(cooldownKey, 60, 'cooldown');
        await this.smsService.sendOtp(sessionData.phone, newOtp, newRefCode);

        return { refCode: newRefCode };
    }


    async forgotPassword(
        phone: string,
    ): Promise<any> {
        const user = await this.userService.findByPhone(phone);
        if (!user) throw new BadRequestException('ไม่พบเบอร์นี้ในระบบ');

        const cooldownKey = `otp-cooldown:${phone}`;
        const hasCooldown = await this.redis.get(cooldownKey);
        if (hasCooldown) {
            throw new BadRequestException('ระบบได้ส่งรหัส OTP ไปแล้ว กรุณารอสักครู่');
        }

        await this.redis.setex(cooldownKey, 60, 'cooldown');

        const otp = this.generateOtp();
        const refCode = this.generateRefCode();
        const sessionId = uuidv4();

        await this.redis.setex(
            `forgot-otp-session:${sessionId}`,
            600,
            JSON.stringify({ phone, otp, refCode, createdAt: Date.now() })
        );

        await this.smsService.sendOtp(phone, otp, refCode);

        return { sessionId };
    }


    async verifyForgotPassword(sessionId: string, otp: string) {
        const sessionKey = `forgot-otp-session:${sessionId}`;
        const data = await this.redis.get(sessionKey);
        if (!data) throw new BadRequestException('OTP หมดอายุหรือไม่พบ session');

        const parsed = JSON.parse(data);
        const { phone, otp: storedOtp, createdAt } = parsed;

        if (storedOtp !== otp) {
            throw new BadRequestException('OTP ไม่ถูกต้อง');
        }

        const lifetime = 5 * 60 * 1000;
        if (Date.now() - createdAt > lifetime) {
            await this.redis.del(sessionKey);
            throw new BadRequestException('OTP หมดอายุ กรุณาขอใหม่');
        }

        await this.redis.setex(
            sessionKey,
            600,
            JSON.stringify({ phone, verified: true }),
        );

        return { sessionId };
    }


    async resetPassword(
        sessionId: string,
        newPassword: string,
        confirmPassword: string
    ): Promise<any> {
        if (newPassword !== confirmPassword) {
            throw new BadRequestException('รหัสผ่านไม่ตรงกัน');
        }

        const sessionKey = `forgot-otp-session:${sessionId}`;
        const sessionData = await this.redis.get(sessionKey);
        if (!sessionData) {
            throw new BadRequestException('Session หมดอายุหรือไม่ถูกต้อง');
        }

        const { phone, verified } = JSON.parse(sessionData);

        if (!verified) {
            throw new BadRequestException('OTP ยังไม่ถูกต้อง');
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        const user = await this.userService.updatePasswordByPhone(phone, hashed);

        await this.redis.del(sessionKey);

        const payload = { sub: user._id.toString() };
        const accessToken = this.jwtService.sign(payload);

        return { accessToken };
    }


    async resendForgotPasswordOtp(sessionId: string): Promise<any> {
        const sessionKey = `forgot-otp-session:${sessionId}`;
        const cooldownKey = `forgot-otp-resend-cooldown:${sessionId}`;

        const hasCooldown = await this.redis.get(cooldownKey);
        if (hasCooldown) {
            throw new BadRequestException('กรุณารอสักครู่ก่อนขอรหัสใหม่อีกครั้ง');
        }

        const sessionRaw = await this.redis.get(sessionKey);
        const ttl = await this.redis.ttl(sessionKey);

        if (!sessionRaw || ttl <= 0) {
            throw new BadRequestException('Session หมดอายุแล้ว กรุณาขอ OTP ใหม่');
        }

        const sessionData = JSON.parse(sessionRaw);

        const newOtp = this.generateOtp();
        const newRefCode = this.generateRefCode();

        await this.redis.setex(
            sessionKey,
            ttl,
            JSON.stringify({
                ...sessionData,
                otp: newOtp,
                refCode: newRefCode,
                createdAt: Date.now(),
            }),
        );

        await this.redis.setex(cooldownKey, 60, 'cooldown');
        await this.smsService.sendOtp(sessionData.phone, newOtp, newRefCode);

        return { refCode: newRefCode };
    }


    async changePassword(
        userId: string,
        body: ChangePasswordDto
    ): Promise<any> {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new BadRequestException('ไม่พบผู้ใช้');
        }

        const isMatch = await bcrypt.compare(body.oldPassword, user.password);
        if (!isMatch) {
            throw new BadRequestException('รหัสผ่านเดิมไม่ถูกต้อง');
        }

        const hashed = await bcrypt.hash(body.newPassword, 10);
        user.password = hashed;
        await user.save();

        return { user };
    }

}
