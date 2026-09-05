import { PrismaService } from './prisma.service';

describe('Prisma startup readiness', () => {
  let service: PrismaService;
  let connectSpy: jest.SpyInstance<Promise<void>, []>;
  let disconnectSpy: jest.SpyInstance<Promise<void>, []>;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test';
    service = new PrismaService();
    connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('requires a successful database query before becoming ready', async () => {
    const querySpy = jest
      .spyOn(service, '$queryRaw')
      .mockResolvedValue([{ ok: 1 }]);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith(['SELECT 1']);
    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it('fails startup and closes the pool when connect succeeds but queries fail', async () => {
    const error = new Error('Connection timeout');
    jest.spyOn(service, '$queryRaw').mockRejectedValue(error);

    await expect(service.onModuleInit()).rejects.toBe(error);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves the connection error even if pool cleanup fails', async () => {
    const error = new Error('Connection timeout');
    connectSpy.mockRejectedValue(error);
    const querySpy = jest.spyOn(service, '$queryRaw');
    disconnectSpy.mockRejectedValue(new Error('Cleanup failed'));

    await expect(service.onModuleInit()).rejects.toBe(error);
    expect(querySpy).not.toHaveBeenCalled();
  });
});
