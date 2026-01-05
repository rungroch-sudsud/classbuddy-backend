import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/role/role.enum';
import { AdminService } from './admin.service';
import { devLog } from 'src/shared/utils/shared.util';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @ApiOperation({ summary: 'ดึงครูที่รอการ verify' })
    @Get('verify/pending')
    @Roles(Role.Admin)
    async getPendingTeachers() {
        const find = await this.adminService.getPendingTeachers();

        return {
            message: 'ดึงข้อมูลสำเร็จ',
            data: find,
        };
    }

    @ApiOperation({ summary: 'ยืนยันการตัวตนของครู' })
    @Patch('teachers/:teacherId/verify')
    @Roles(Role.Admin)
    async verifyTeacher(@Param('teacherId') teacherId: string) {
        await this.adminService.verifyTeacher(teacherId);

        return {
            message: 'ยืนยันตัวตนครูคนนี้เรียบร้อย',
            data: null,
        };
    }

    @ApiOperation({ summary: 'ปฎิเสฑเอกสารของครู' })
    @Patch('teachers/:teacherId/reject')
    @Roles(Role.Admin)
    async rejectTeacher(@Param('teacherId') teacherId: string) {
        const reject = await this.adminService.rejectTeacher(teacherId);

        return {
            message: 'ปฎิเสธการยืนยันตัวตนครูคนนี้เรียบร้อย',
            data: reject,
        };
    }

    @ApiOperation({ summary: 'ดึงคลาสที่กำลังจะมาถึงทั้งหมด' })
    @Get('classes/incoming')
    @Roles(Role.Admin)
    async getIncomingClasses() {
        const classes = await this.adminService.getIncomingClasses();

        return {
            message: 'ดึงข้อมูลคลาสที่กำลังจะมาถึงสำเร็จ',
            data: classes,
        };
    }
}
