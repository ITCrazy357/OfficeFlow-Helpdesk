import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateLeaveRequestDto } from './create-leave-request.dto';
import { GetLeaveRequestDto } from './get-leave-request.dto';
import { RejectLeaveRequestDto } from './reject-leave-request.dto';
import { SetLeaveEntitlementDto } from './leave-planning.dto';

describe('Leave request DTOs', () => {
  it.each([0, 0.5, 1, 12.5, 366])(
    'accepts a valid %s-day allowance without integer-divisor validation',
    async (days) => {
      await expect(
        validate(plainToInstance(SetLeaveEntitlementDto, { days, version: 0 })),
      ).resolves.toHaveLength(0);
    },
  );
  it.each([12.25, -0.5, 366.5, '12.5', null, undefined])(
    'rejects an invalid allowance %s',
    async (days) => {
      await expect(
        validate(plainToInstance(SetLeaveEntitlementDto, { days, version: 0 })),
      ).resolves.not.toHaveLength(0);
    },
  );
  it('accepts a valid create payload and trims its reason', async () => {
    const dto = plainToInstance(CreateLeaveRequestDto, {
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      reason: '  Family appointment  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reason).toBe('Family appointment');
  });

  it('rejects a malformed date string', async () => {
    const dto = plainToInstance(CreateLeaveRequestDto, {
      startDate: '10/09/2026',
      endDate: '2026-09-12',
      reason: 'Family appointment',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('converts pagination query values into bounded integers', async () => {
    const dto = plainToInstance(GetLeaveRequestDto, {
      page: '2',
      limit: '25',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(25);
  });

  it('rejects a blank rejection note after trimming', async () => {
    const dto = plainToInstance(RejectLeaveRequestDto, {
      reviewNote: '   ',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
    expect(dto.reviewNote).toBe('');
  });
});
