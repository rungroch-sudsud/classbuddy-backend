import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/strategies/auth.guard';
import { CurrentUser } from 'src/shared/utils/currentUser';
import { CreateSlotDto } from './schemas/slot.zod.schema';


@ApiTags('Slots')
@ApiBearerAuth()
@Controller('slots')
export class SlotsController {
    constructor(private readonly slotsService: SlotsService) { }

    @Post()
    @ApiBody({ type: CreateSlotDto })
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


    @Get()
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
