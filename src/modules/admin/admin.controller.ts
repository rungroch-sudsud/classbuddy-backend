import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtGuard } from '../auth/strategies/auth.guard';



@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService
    ) { }


    @Get('verify/pending')
    @UseGuards(JwtGuard)
    async getPendingTeachers() {
        const find = await this.adminService.getPendingTeachers();

        return {
            message: 'ดึงข้อมูลสำเร็จ',
            data: find,
        };
    }

    @Patch(':teacherId/verify')
    @UseGuards(JwtGuard)
    async verifyTeacher(
        @Param('teacherId') teacherId: string) {
        const verify = await this.adminService.verifyTeacher(teacherId);

        return {
            message: 'ยืนยันตัวตนครูคนนี้เรียบร้อย',
            data: verify,
        };
    }

    @Patch(':teacherId/reject')
    @UseGuards(JwtGuard)
    async rejectTeacher(
        @Param('teacherId') teacherId: string) {
        const reject = await this.adminService.rejectTeacher(teacherId);

        return {
            message: 'ปฎิเสธการยืนยันตัวตนครูคนนี้เรียบร้อย',
            data: reject,
        };
    }

}
