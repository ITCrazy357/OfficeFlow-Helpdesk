import { Test, TestingModule } from '@nestjs/testing';
import { AccountService } from './accounts.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  changeActivationStatus: jest.fn(),
  resetPassword: jest.fn(),
};

const mockAccountService = {
  lockUser: jest.fn(),
  unlockUser: jest.fn(),
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
        {
          provide: AccountService,
          useValue: mockAccountService,
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

  it('should lock a user through AccountService', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };

    await controller.changeAccountLock(2, { isLocked: true }, currentUser);

    expect(mockAccountService.lockUser).toHaveBeenCalledWith(currentUser, 2);
    expect(mockAccountService.unlockUser).not.toHaveBeenCalled();
  });

  it('should change organization activation through UsersService', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.ADMIN,
    };
    const dto = { isActive: false };

    await controller.changeActivationStatus(2, dto, currentUser);

    expect(mockUsersService.changeActivationStatus).toHaveBeenCalledWith(
      2,
      dto,
      currentUser,
    );
  });

  it('should unlock a user through AccountService', async () => {
    const currentUser = {
      userId: 1,
      role: UserRole.IT_STAFF,
    };

    await controller.changeAccountLock(2, { isLocked: false }, currentUser);

    expect(mockAccountService.unlockUser).toHaveBeenCalledWith(currentUser, 2);
    expect(mockAccountService.lockUser).not.toHaveBeenCalled();
  });
});
