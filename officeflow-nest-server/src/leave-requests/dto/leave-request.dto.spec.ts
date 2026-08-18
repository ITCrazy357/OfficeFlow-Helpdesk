import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateLeaveRequestDto } from './create-leave-request.dto';
import { GetLeaveRequestDto } from './get-leave-request.dto';
import { RejectLeaveRequestDto } from './reject-leave-request.dto';

describe('Leave request DTOs', () => {
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
