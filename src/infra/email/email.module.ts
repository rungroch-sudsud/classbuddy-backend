import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTestController } from './email.controller';

@Module({
    controllers: [EmailTestController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
