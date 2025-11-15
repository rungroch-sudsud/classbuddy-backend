import { Test, TestingModule } from '@nestjs/testing';
import { SubjectrequestsService } from './subjectrequests.service';

describe('SubjectrequestsService', () => {
  let service: SubjectrequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SubjectrequestsService],
    }).compile();

    service = module.get<SubjectrequestsService>(SubjectrequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
