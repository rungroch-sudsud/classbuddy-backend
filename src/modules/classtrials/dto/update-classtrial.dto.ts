import { PartialType } from '@nestjs/mapped-types';
import { CreateClasstrialDto } from './create-classtrial.dto';

export class UpdateClasstrialDto extends PartialType(CreateClasstrialDto) {}
