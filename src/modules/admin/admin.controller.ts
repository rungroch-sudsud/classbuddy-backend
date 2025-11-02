import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/role/role.enum';



@ApiTags('Admin')
@ApiBearerAuth()

@Controller('admin')
@UseGuards(JwtGuard)
// @UseGuards(JwtGuard, RolesGuard)
// @Roles(Role.Admin, Role.Moderator)

export class AdminController {
    constructor(
        private readonly adminService: AdminService
    ) { }


    @ApiOperation({ summary: 'ดึงครูที่รอการ verify' })
    @Get('verify/pending')
    async getPendingTeachers() {
        const find = await this.adminService.getPendingTeachers();

        return {
            message: 'ดึงข้อมูลสำเร็จ',
            data: find,
        };
    }


    @ApiOperation({ summary: 'ยืนยันการตัวตนของครู' })
    @Patch(':teacherId/verify')
    async verifyTeacher(
        @Param('teacherId') teacherId: string) {
        const verify = await this.adminService.verifyTeacher(teacherId);

        return {
            message: 'ยืนยันตัวตนครูคนนี้เรียบร้อย',
            data: verify,
        };
    }

    @ApiOperation({ summary: 'ปฎิเสฑเอกสารของครู' })
    @Patch(':teacherId/reject')
    async rejectTeacher(
        @Param('teacherId') teacherId: string) {
        const reject = await this.adminService.rejectTeacher(teacherId);

        return {
            message: 'ปฎิเสธการยืนยันตัวตนครูคนนี้เรียบร้อย',
            data: reject,
        };
    }

}
