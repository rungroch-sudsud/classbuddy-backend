import { Test, TestingModule } from '@nestjs/testing';
import { BlacklistsController } from './blacklists.controller';
import { BlacklistsService } from './blacklists.service';

describe('BlacklistsController', () => {
  let controller: BlacklistsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlacklistsController],
      providers: [BlacklistsService],
    }).compile();

    controller = module.get<BlacklistsController>(BlacklistsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
