import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { CreateSlotDto, CreateWeeklySlotDto } from './schemas/slot.zod.schema';

@ApiExtraModels(CreateSlotDto, CreateWeeklySlotDto)
@ApiTags('Slots')
@ApiBearerAuth()
@Controller('slots')
export class SlotsController {
    constructor(private readonly slotsService: SlotsService) { }

    @Post()
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
            weeklySlot: {
                summary: 'Weekly Slot (ระบุช่วงเวลา + วันในสัปดาห์)',
                description: 'ใช้สำหรับสร้าง slot แบบซ้ำประจำสัปดาห์',
                value: {
                    from: '2026-10-09',
                    to: '2026-10-16',
                    weeklySlots: {
                        '1': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                        '2': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                        '3': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                        '4': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                        '5': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                        '6': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                        '7': [
                            { startTime: '12:00', endTime: '13:00' },
                            { startTime: '15:00', endTime: '18:00' },
                        ],
                    },
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
            message: 'Create slots successfully',
            data: create,
        };
    }


    @Get('')
    async getAllSubject() {
        const getAll = await this.slotsService.getAllSlots();

        return {
            message: 'get all slots successfully',
            data: getAll,
        };
    }


    @UseGuards(JwtGuard)
    @Get('mine')
    async getMySlots(
        @CurrentUser() teacherId: string
    ) {
        const slots = await this.slotsService.getMineSlot(teacherId);

        return {
            message: 'ดึง slot ของฉันสำเร็จ',
            data: slots,
        };
    }


}
