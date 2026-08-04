import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  changeStatus: jest.fn(),
  resetPassword: jest.fn(),
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

  it('should create a user with the current admin', async () => {
    const dto = {
      name: 'Employee',
      email: 'employee@officeflow.com',
      password: 'strong-password-123',
      role: UserRole.EMPLOYEE,
      departmentId: 1,
    };
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    mockUsersService.create.mockResolvedValue({ id: 2, ...dto });

    await controller.create(dto, currentUser);

    expect(mockUsersService.create).toHaveBeenCalledWith(dto, currentUser);
  });

  it('should change user status with the current admin', async () => {
    const dto = {
      isActive: false,
    };
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    await controller.changeStatus(2, dto, currentUser);

    expect(mockUsersService.changeStatus).toHaveBeenCalledWith(
      2,
      dto,
      currentUser,
    );
  });
});
