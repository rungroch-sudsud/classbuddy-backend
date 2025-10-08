import { Controller, Post, Body, BadRequestException, Patch, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from 'src/shared/validators/zod.validation.pipe';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { ChangePasswordDto, forgotPasswordOtpDto, LoginDto, RegisterDto, ResendOtpDto, ResetPasswordDto, VerifyForgotPasswordDto, VerifyOtpDto, VerifyOtpSchema } from './schemas/auth.zod.schema';
import { LoginSchema, RegisterSchema } from './schemas/auth.zod.schema';
import { JwtGuard } from './strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';



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
            message: 'Send opt successfully',
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


    @Post('resend-otp')
    @ApiBody({ type: ResendOtpDto })
    async resendOtp(@Body('sessionId') sessionId: string
    ): Promise<any> {
        if (!sessionId) throw new BadRequestException('กรุณาระบุ sessionId');
        const resend = await this.authService.resendOtp(sessionId);

        return {
            message: 'Resend opt successfully',
            data: resend,
        };
    }


    @Post('forgot-password')
    @ApiBody({ type: forgotPasswordOtpDto })
    async requestOtp(@Body() body: forgotPasswordOtpDto) {
        const forgot = await this.authService.forgotPassword(body.phone);

        return {
            message: 'Send OTP successfully',
            data: forgot,
        };
    }

    @Post('forgot-password/verify-otp')
    @ApiBody({ type: VerifyForgotPasswordDto })
    async verifyForgotPassword(@Body() body: VerifyOtpDto) {
        const verify = await this.authService.verifyForgotPassword(
            body.sessionId,
            body.otp
        );

        return {
            message: 'Verify opt successfully',
            data: verify,
        };
    }


    @Patch('forgot-password/reset')
    @ApiBody({ type: ResetPasswordDto })
    async resetPassword(@Body() body: ResetPasswordDto) {
        const reset = await this.authService.resetPassword(
            body.sessionId,
            body.newPassword,
            body.confirmPassword,
        );

        return {
            message: 'Reset password successfully',
            data: reset,
        };
    }


    @Post('forgot-password/resend-otp')
    @ApiBody({ type: ResendOtpDto })
    async resendForgotPasswordOtp(@Body('sessionId') sessionId: string) {
        if (!sessionId) throw new BadRequestException('กรุณาระบุ sessionId');
        const resend = await this.authService.resendForgotPasswordOtp(sessionId);

        return {
            message: 'Resend OTP successfully',
            data: resend,
        };
    }


    @UseGuards(JwtGuard)
    @ApiBody({ type: ChangePasswordDto})
    @Patch('change-password')
    async changePassword(
        @CurrentUser() userId: string,
        @Body() body: ChangePasswordDto
    ) {
        const change = await this.authService.changePassword(userId, body);

        return {
            message: 'Change password successfully',
            data: change,
        };
    }

}
