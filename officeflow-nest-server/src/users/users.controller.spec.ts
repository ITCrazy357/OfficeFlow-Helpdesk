import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

const mockUsersService = {
  findAll: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should return users from service', async () => {
    const users = [
      {
        id: 1,
        name: 'Admin',
        email: 'admin@officeflow.com',
        role: UserRole.ADMIN,
        isActive: true,
      },
    ];

    mockUsersService.findAll.mockResolvedValue(users);

    const result = await controller.findAll();

    expect(mockUsersService.findAll).toHaveBeenCalled();
    expect(result).toEqual(users);
  });
});
