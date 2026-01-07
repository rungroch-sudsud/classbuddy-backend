import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Role } from '../auth/role/role.enum';
import { AdminService } from './admin.service';
import { BookingService } from '../booking/booking.service';
import { RescheduleClassDto } from './dto/reschedule-class.dto';
import { User } from '../users/schemas/user.schema';
import { CurrentUser } from 'src/shared/utils/currentUser';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtGuard, RolesGuard)
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly bookingService: BookingService,
    ) {}

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

    @ApiOperation({ summary: 'ดึงคลาสทั้งหมด' })
    @Get('classes')
    @Roles(Role.Admin)
    async getAllClasses() {
        const classes = await this.adminService.getAllClasses();

        return {
            message: 'ดึงข้อมูลคลาสทั้งหมดสำเร็จ',
            data: classes,
        };
    }

    @ApiOperation({ summary: 'เลื่อนเวลาคลาสเรียน' })
    @Patch('bookings/:bookingId/reschedule')
    @Roles(Role.Admin)
    async rescheduleClass(
        @Param('bookingId') bookingId: string,
        @Body() body: RescheduleClassDto,
        @CurrentUser() currentUserId: string,
    ) {
        const rescheduledClass = await this.bookingService.reschedule(
            bookingId,
            currentUserId,
            body.newStartTime,
            body.newEndTime,
        );

        return {
            message: 'เลื่อนเวลาคลาสเรียนสำเร็จ',
            data: rescheduledClass,
        };
    }
}
