import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrismaService = {
  department: {
    findMany: jest.fn(),
  },
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
    it('should return departments when the database is connected', async () => {
      const departments = [{ id: 1, name: 'Engineering' }];

      mockPrismaService.department.findMany.mockResolvedValue(departments);

      await expect(appController.getDbHealth()).resolves.toEqual(departments);
      expect(mockPrismaService.department.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
