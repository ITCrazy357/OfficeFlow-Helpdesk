import { Test, TestingModule } from '@nestjs/testing';
import { LeaveStatus, UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

import { LeaveRequestController } from './leave-requests.controller';
import { LeaveRequestService } from './leave-requests.service';

const mockLeaveRequestService = {
  create: jest.fn(),
  findMine: jest.fn(),
  findPendingApproval: jest.fn(),
  findOne: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  cancel: jest.fn(),
};

describe('LeaveRequestController', () => {
  let controller: LeaveRequestController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveRequestController],
      providers: [
        {
          provide: LeaveRequestService,
          useValue: mockLeaveRequestService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LeaveRequestController>(LeaveRequestController);
  });

  it('gets leave requests for the current user', async () => {
    const currentUser = {
      userId: 10,
      role: UserRole.EMPLOYEE,
    };
    const query = {
      page: 1,
      limit: 10,
      status: LeaveStatus.PENDING,
    };

    await controller.findMine(query, currentUser);

    expect(mockLeaveRequestService.findMine).toHaveBeenCalledWith(
      currentUser,
      query,
    );
  });

  it('gets only requests assigned to the current approver', async () => {
    const currentUser = {
      userId: 20,
      role: UserRole.ADMIN,
    };
    const query = {
      page: 1,
      limit: 10,
    };

    await controller.findPendingApproval(query, currentUser);

    expect(mockLeaveRequestService.findPendingApproval).toHaveBeenCalledWith(
      currentUser,
      query,
    );
  });

  it('creates a leave request for the current user', async () => {
    const currentUser = {
      userId: 10,
      role: UserRole.EMPLOYEE,
    };
    const dto = {
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      reason: 'Family appointment',
    };

    await controller.create(dto, currentUser);

    expect(mockLeaveRequestService.create).toHaveBeenCalledWith(
      dto,
      currentUser,
    );
  });

  it('gets a scoped leave request by id', async () => {
    const currentUser = { userId: 10, role: UserRole.EMPLOYEE };

    await controller.findOne(15, currentUser);

    expect(mockLeaveRequestService.findOne).toHaveBeenCalledWith(
      15,
      currentUser,
    );
  });

  it('approves an assigned leave request', async () => {
    const currentUser = { userId: 20, role: UserRole.MANAGER };

    await controller.approve(15, currentUser);

    expect(mockLeaveRequestService.approve).toHaveBeenCalledWith(
      15,
      currentUser,
    );
  });

  it('rejects an assigned leave request with a review note', async () => {
    const currentUser = { userId: 20, role: UserRole.ADMIN };
    const dto = { reviewNote: 'Coverage is unavailable' };

    await controller.reject(15, dto, currentUser);

    expect(mockLeaveRequestService.reject).toHaveBeenCalledWith(
      15,
      dto,
      currentUser,
    );
  });

  it('cancels the current user leave request', async () => {
    const currentUser = { userId: 10, role: UserRole.EMPLOYEE };

    await controller.cancel(15, currentUser);

    expect(mockLeaveRequestService.cancel).toHaveBeenCalledWith(
      15,
      currentUser,
    );
  });
});
