import { Test, TestingModule } from '@nestjs/testing';
import { RecurringController } from './recurring.controller';

describe('RecurringController', () => {
  let controller: RecurringController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecurringController],
    }).compile();

    controller = module.get<RecurringController>(RecurringController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
