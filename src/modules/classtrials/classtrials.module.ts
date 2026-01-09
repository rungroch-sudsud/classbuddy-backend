import { Module } from '@nestjs/common';
import { ClasstrialsService } from './classtrials.service';
import { ClasstrialsController } from './classtrials.controller';

@Module({
  controllers: [ClasstrialsController],
  providers: [ClasstrialsService],
})
export class ClasstrialsModule {}
