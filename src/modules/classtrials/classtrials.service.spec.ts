import { Test, TestingModule } from '@nestjs/testing';
import { ClasstrialsService } from './classtrials.service';

describe('ClasstrialsService', () => {
  let service: ClasstrialsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClasstrialsService],
    }).compile();

    service = module.get<ClasstrialsService>(ClasstrialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
