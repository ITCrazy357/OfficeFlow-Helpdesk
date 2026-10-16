import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AuditLogAction,
  AuditLogEntity,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { runSerializableTransaction } from '../common/database/serializable-transaction.util';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  DEFAULT_SLA_POLICY,
  type SlaPolicyConfig,
  validateSlaPolicy,
} from './sla-policy';
import { calculateTicketDeadlines } from './sla-calendar';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';

@Injectable()
export class SlaPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async get(
    database: Pick<Prisma.TransactionClient, 'slaPolicy'> = this.prisma,
  ) {
    const policy = await database.slaPolicy.findUnique({ where: { id: 1 } });
    return {
      version: policy?.version ?? 0,
      config: policy
        ? (policy.config as unknown as SlaPolicyConfig)
        : structuredClone(DEFAULT_SLA_POLICY),
      updatedAt: policy?.updatedAt ?? null,
    };
  }

  async update(dto: UpdateSlaPolicyDto, actor: CurrentUserPayload) {
    if (actor.role !== UserRole.ADMIN)
      throw new ForbiddenException('Forbidden');
    const config = validateSlaPolicy(dto.config);
    // Reject policies whose calendar cannot produce a supported deadline.
    for (const priority of Object.keys(config.targets) as Array<
      keyof typeof config.targets
    >) {
      calculateTicketDeadlines(new Date(), priority, config);
    }
    try {
      return await runSerializableTransaction(this.prisma, async (tx) => {
        const previous = await this.get(tx);
        if (previous.version !== dto.version)
          throw new ConflictException(
            'SLA policy changed. Reload before saving',
          );
        const saved = await tx.slaPolicy.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            config: config,
          },
          update: {
            config: config,
            version: { increment: 1 },
          },
        });
        await this.audit.create(
          {
            actorId: actor.userId,
            entity: AuditLogEntity.SLA_POLICY,
            entityId: 1,
            action: AuditLogAction.UPDATE,
            description: 'Updated SLA policy for new tickets.',
            oldValues: previous.config,
            newValues: config,
            ipAddress: actor.ipAddress,
            userAgent: actor.userAgent,
          },
          tx,
        );
        return { version: saved.version, config, updatedAt: saved.updatedAt };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('SLA policy changed. Reload before saving');
      }
      throw error;
    }
  }
}
