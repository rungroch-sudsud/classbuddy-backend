import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ClasstrialsService } from './classtrials.service';
import { CreateClasstrialDto } from './dto/create-classtrial.dto';
import { UpdateClasstrialDto } from './dto/update-classtrial.dto';

@Controller('classtrials')
export class ClasstrialsController {
  constructor(private readonly classtrialsService: ClasstrialsService) {}

  @Post()
  create(@Body() createClasstrialDto: CreateClasstrialDto) {
    return this.classtrialsService.create(createClasstrialDto);
  }

  @Get()
  findAll() {
    return this.classtrialsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classtrialsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClasstrialDto: UpdateClasstrialDto) {
    return this.classtrialsService.update(+id, updateClasstrialDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classtrialsService.remove(+id);
  }
}
