import { Test, TestingModule } from '@nestjs/testing';
import { ClasstrialsController } from './classtrials.controller';
import { ClasstrialsService } from './classtrials.service';

describe('ClasstrialsController', () => {
  let controller: ClasstrialsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClasstrialsController],
      providers: [ClasstrialsService],
    }).compile();

    controller = module.get<ClasstrialsController>(ClasstrialsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
