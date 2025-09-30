import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from 'src/shared/validators/zod-validation';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { LoginDto, RegisterDto, VerifyOtpDto, VerifyOtpSchema } from './schemas/auth.zod.schema';
import { LoginSchema, RegisterSchema } from './schemas/auth.zod.schema';



@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }


    @Post('register')
    @ApiBody({ type: RegisterDto })
    async register(
        @Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto,
    ) {
        const register = await this.authService.register(body);

        return {
            message: 'User created successfully',
            data: register,
        };
    }


    @Post('verify-otp')
    @ApiBody({ type: VerifyOtpDto })
    async verifyRegisterOtp(
        @Body(new ZodValidationPipe()) body: VerifyOtpDto
    ) {
        const verify = await this.authService.verifyRegisterOtp(body);

        return {
            message: 'Register successfully',
            data: verify,
        };
    }


    @Post('login')
    @ApiBody({ type: LoginDto })
    async login(
        @Body(new ZodValidationPipe()) body: LoginDto
    ) {
        const login = await this.authService.login(body);

        return {
            message: 'Login successfully',
            data: login,
        };
    }



}
