import { Test, TestingModule } from '@nestjs/testing';
import { TronService } from './tron.service';

describe('TronService', () => {
  let service: TronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TronService],
    }).compile();

    service = module.get<TronService>(TronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
