import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { runSerializableTransaction } from './serializable-transaction.util';

describe('runSerializableTransaction', () => {
  const conflict = () =>
    new Prisma.PrismaClientKnownRequestError('Deadlock', {
      code: 'P2034',
      clientVersion: '7',
    });

  it('retries the entire callback with a fresh transaction after P2034', async () => {
    const first = { attempt: 1 };
    const second = { attempt: 2 };
    const callback = jest
      .fn()
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce('ok');
    const $transaction = jest
      .fn()
      .mockImplementationOnce((work: (tx: unknown) => Promise<unknown>) =>
        work(first),
      )
      .mockImplementationOnce((work: (tx: unknown) => Promise<unknown>) =>
        work(second),
      );
    await expect(
      runSerializableTransaction(
        { $transaction } as unknown as PrismaService,
        callback,
      ),
    ).resolves.toBe('ok');
    expect(callback.mock.calls).toEqual([[first], [second]]);
    expect($transaction).toHaveBeenCalledWith(callback, {
      isolationLevel: 'Serializable',
    });
  });

  it('stops after three conflicts', async () => {
    const $transaction = jest.fn().mockRejectedValue(conflict());
    await expect(
      runSerializableTransaction(
        { $transaction } as unknown as PrismaService,
        jest.fn(),
      ),
    ).rejects.toThrow(ConflictException);
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it.each([
    new ConflictException('Handoff required'),
    new Error('Database unavailable'),
    new Prisma.PrismaClientKnownRequestError('Transaction expired', {
      code: 'P2028',
      clientVersion: '7',
    }),
    new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: '7',
    }),
  ])('does not retry unrelated errors: %s', async (error) => {
    const $transaction = jest.fn().mockRejectedValue(error);
    await expect(
      runSerializableTransaction(
        { $transaction } as unknown as PrismaService,
        jest.fn(),
      ),
    ).rejects.toBe(error);
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
