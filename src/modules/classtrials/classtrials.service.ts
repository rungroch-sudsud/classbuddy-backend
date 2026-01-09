import { Injectable } from '@nestjs/common';
import { CreateClasstrialDto } from './dto/create-classtrial.dto';
import { UpdateClasstrialDto } from './dto/update-classtrial.dto';

@Injectable()
export class ClasstrialsService {
  create(createClasstrialDto: CreateClasstrialDto) {
    return 'This action adds a new classtrial';
  }

  findAll() {
    return `This action returns all classtrials`;
  }

  findOne(id: number) {
    return `This action returns a #${id} classtrial`;
  }

  update(id: number, updateClasstrialDto: UpdateClasstrialDto) {
    return `This action updates a #${id} classtrial`;
  }

  remove(id: number) {
    return `This action removes a #${id} classtrial`;
  }
}
