import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

const mockPrismaService = {
  assertReady: jest.fn(),
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
        version: 'local',
      });
    });
  });

  describe('getDbHealth', () => {
    it('requires the connection and release schema to be ready', async () => {
      mockPrismaService.assertReady.mockResolvedValue(undefined);

      await expect(appController.getDbHealth()).resolves.toEqual({
        status: 'ok',
        version: 'local',
      });
      expect(mockPrismaService.assertReady).toHaveBeenCalledTimes(1);
    });

    it('does not report success when the schema check fails', async () => {
      const error = new Error('Missing SLA schema');
      mockPrismaService.assertReady.mockRejectedValue(error);
      await expect(appController.getDbHealth()).rejects.toBe(error);
    });
  });
});
