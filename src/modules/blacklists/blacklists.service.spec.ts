import { Test, TestingModule } from '@nestjs/testing';
import { BlacklistsService } from './blacklists.service';

describe('BlacklistsService', () => {
  let service: BlacklistsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlacklistsService],
    }).compile();

    service = module.get<BlacklistsService>(BlacklistsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
