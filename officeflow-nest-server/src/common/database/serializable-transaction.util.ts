import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';

export async function runSerializableTransaction<T>(
  prisma: PrismaService,
  work: (transaction: Prisma.TransactionClient) => Promise<T>,
  timing: { maxWait?: number; timeout?: number } = {},
): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(work, {
        ...timing,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isWriteConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';

      if (!isWriteConflict) {
        throw error;
      }

      if (attempt === maxAttempts) {
        throw new ConflictException(
          'Data changed concurrently. Please try again',
        );
      }
    }
  }

  throw new ConflictException('Transaction could not be completed');
}
