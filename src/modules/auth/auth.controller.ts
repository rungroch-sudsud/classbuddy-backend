import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    
    @Post('register')
    async register(
        @Body() body: { phone: string; password: string; confirmPassword: string }
    ) {
        return this.authService.register(body.phone, body.password, body.confirmPassword);
    }


    @Post('verify-otp')
    async verifyRegisterOtp(
        @Body('phone') phone: string,
        @Body('otp') otp: string,
        @Body('password') password: string,
    ) {
        if (!phone || !otp || !password) {
            throw new BadRequestException('Missing required fields');
        }
        return this.authService.verifyRegisterOtp(phone, otp, password);
    }






}
