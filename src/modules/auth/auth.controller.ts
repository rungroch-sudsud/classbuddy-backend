import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterSchema } from '../users/schemas/user.zod.schema';
import { ZodValidationPipe } from 'src/shared/validators/zod-validation';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }


    @Post('register')
    async register(
        @Body(new ZodValidationPipe(RegisterSchema)) body: any,
    ) {
        const register = await this.authService.register(body);

        return {
            message: 'User created successfully',
            data: register,
        };
    }


    @Post('verify-otp')
    async verifyRegisterOtp(
        @Body() body: any
    ) {
        const verify = await this.authService.verifyRegisterOtp(body);

        return {
            message: 'Register successfully',
            data: verify,
        };
    }






}
