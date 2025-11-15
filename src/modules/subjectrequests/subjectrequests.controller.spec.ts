import { Test, TestingModule } from '@nestjs/testing';
import { SubjectrequestsController } from './subjectrequests.controller';
import { SubjectrequestsService } from './subjectrequests.service';

describe('SubjectrequestsController', () => {
  let controller: SubjectrequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubjectrequestsController],
      providers: [SubjectrequestsService],
    }).compile();

    controller = module.get<SubjectrequestsController>(SubjectrequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
