import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrismaService = {
  $queryRaw: jest.fn(),
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return the API health status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
      });
    });
  });

  describe('getDbHealth', () => {
    it('should check the database connection', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ connected: 1 }]);

      await expect(appController.getDbHealth()).resolves.toBeUndefined();
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
