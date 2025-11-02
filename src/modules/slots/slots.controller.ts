import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guard/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { CreateSlotDto, CreateWeeklySlotDto } from './schemas/slot.zod.schema';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Role } from '../auth/role/role.enum';

@ApiExtraModels(CreateSlotDto, CreateWeeklySlotDto)
@ApiTags('Slots')
@ApiBearerAuth()

@Controller('slots')
@UseGuards(JwtGuard, RolesGuard)
// @Roles(Role.Admin, Role.Moderator, Role.Teacher)

export class SlotsController {
    constructor(
        private readonly slotsService: SlotsService
    ) { }


    @Post()
    @ApiOperation({ summary: 'สร้าง slot' })
    @ApiBody({
        schema: {
            oneOf: [
                { $ref: getSchemaPath(CreateSlotDto) },
                { $ref: getSchemaPath(CreateWeeklySlotDto) },
            ],
        },
        examples: {
            customSlot: {
                summary: 'Single Slot (ระบุวันเดียว)',
                description: 'ใช้สำหรับสร้าง slot แบบครั้งเดียว',
                value: {
                    date: '2026-10-09',
                    startTime: '12:00',
                    endTime: '13:00',
                },
            },
            hasDailyRecurring: {
                summary: 'Daily Slot (รายวัน x7 วัน)',
                description: 'สร้าง slot เวลาเดียวกันต่อเนื่องทุกวัน เป็นเวลา 7 วัน',
                value: {
                    date: '2026-11-10',
                    startTime: '12:00',
                    endTime: '13:00',
                    repeatDailyForDays: 7,
                },
            },
        },
    })
    @UseGuards(JwtGuard)
    async createSlots(
        @CurrentUser() teacherId: string,
        @Body() body: any,
    ) {
        const create = await this.slotsService.createSlots(teacherId, body);

        return {
            message: 'สร้างตารางสอนสำเร็จ',
            data: create,
        };
    }


    @Get('')
    @ApiOperation({ summary: 'ดึง slot ทั้งหมด' })
    @Roles(Role.Admin, Role.Moderator)
    async getAllSubject() {
        const getAll = await this.slotsService.getAllSlots();

        return {
            message: 'get all slots successfully',
            data: getAll,
        };
    }


    @ApiOperation({ summary: 'ดึงตารางสอนของฉัน' })
    @Get('booking/mine')
    async getMySlots(@CurrentUser() teacherId: string) {
        const slots = await this.slotsService.getMineSlot(teacherId);

        return {
            message: 'ดึง slot ของฉันสำเร็จ',
            data: slots,
        };
    }


    @ApiOperation({ summary: 'slot ที่ผ่านมา' })
    @Get('booking/history/mine')
    async getHistorySlotsMine(@CurrentUser() userId: string) {
        const data = await this.slotsService.getHistorySlotsMine(userId);

        return {
            message: 'ดึงประวัติการจองสำเร็จ',
            data,
        };
    }


    @ApiOperation({ summary: 'ดึง slot ทั้งหมดของครูคนนั้น' })
    @Get(':teacherId')
    async getAllSlotByTeacherId(
        @Param('teacherId') teacherId: string,
    ) {
        const slots = await this.slotsService.getAllSlotByTeacherId(teacherId);

        return {
            message: 'ดึง slot สำเร็จ',
            data: slots,
        };
    }


    @Get(':slotId')
    async getSlotById(
        @CurrentUser() userId: string,
        @Param('slotId') slotId: string
    ) {
        const slots = await this.slotsService.getSlotById(userId, slotId);

        return {
            message: 'ดึง slot สำเร็จ',
            data: slots,
        };
    }


    @Patch(':slotId/finish')
    @ApiOperation({ summary: 'ครูกดจบคลาส' })
    async finishSlot(
        @Param('slotId') slotId: string,
        @CurrentUser() userId: string
    ) {
        const slot = await this.slotsService.finishSlotByTeacher(
            slotId,
            userId
        );

        return {
            message: 'คุณได้จบคลาสนี้เรียบร้อย',
            data: slot,
        };
    }

}
