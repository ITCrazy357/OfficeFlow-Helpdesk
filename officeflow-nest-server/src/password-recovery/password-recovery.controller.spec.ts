import type { Request, Response } from 'express';

import { PasswordRecoveryController } from './password-recovery.controller';
import type { PasswordRecoveryService } from './password-recovery.service';

const mockPasswordRecoveryService = {
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};

describe('PasswordRecoveryController', () => {
  let controller: PasswordRecoveryController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PasswordRecoveryController(
      mockPasswordRecoveryService as unknown as PasswordRecoveryService,
    );
  });

  it('passes request metadata to the generic forgot-password flow', async () => {
    const dto = { email: 'employee@example.com' };
    const request = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    } as Request;
    mockPasswordRecoveryService.forgotPassword.mockResolvedValue({
      accepted: true,
    });

    await expect(controller.forgotPassword(dto, request)).resolves.toEqual({
      accepted: true,
    });
    expect(mockPasswordRecoveryService.forgotPassword).toHaveBeenCalledWith(
      dto,
      {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      },
    );
  });

  it('clears the refresh cookie after a successful password reset', async () => {
    const dto = {
      token: 'a'.repeat(43),
      newPassword: 'new-secure-password-456',
    };
    const request = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    } as Request;
    const setHeader = jest.fn();
    const clearCookie = jest.fn();
    const response = {
      setHeader,
      clearCookie,
    } as unknown as Response;
    mockPasswordRecoveryService.resetPassword.mockResolvedValue({
      passwordReset: true,
    });

    await expect(
      controller.resetPassword(dto, request, response),
    ).resolves.toEqual({ passwordReset: true });
    expect(clearCookie).toHaveBeenCalled();
  });
});
