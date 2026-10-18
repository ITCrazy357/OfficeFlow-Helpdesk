import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { RedisService } from '../redis/redis.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { AiProvider } from './ai.provider';
import { AiRequestLimiter } from './ai-request-limiter';
import { redactAiText } from './ai-prompt';
import { AiTask, type AiDraft } from './types/ai-draft.type';

const MAX_COMMENTS = 20;
const ticketSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  updatedAt: true,
  comments: {
    take: MAX_COMMENTS,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { role: true } },
    },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.TicketSelect;
const sourceSelect = {
  id: true,
  title: true,
  summary: true,
  content: true,
  updatedAt: true,
} satisfies Prisma.KnowledgeArticleSelect;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
    private readonly provider: AiProvider,
    private readonly limiter: AiRequestLimiter,
    private readonly redis: RedisService,
  ) {}

  private assertStaff(actor: CurrentUserPayload) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.IT_STAFF)
      throw new ForbiddenException(
        'Chỉ ADMIN và IT_STAFF được sử dụng AI hỗ trợ.',
      );
  }

  status(actor: CurrentUserPayload) {
    this.assertStaff(actor);
    const { enabled, model } = this.provider.status();
    return {
      enabled: enabled && this.redis.isReady(),
      model,
      reason: !enabled
        ? 'DISABLED'
        : !this.redis.isReady()
          ? 'UNAVAILABLE'
          : null,
    };
  }

  private async ticket(id: number) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: ticketSelect,
    });
    if (!ticket) throw new NotFoundException('Không tìm thấy ticket.');
    return ticket;
  }

  private isResolved(ticket: { status: TicketStatus }) {
    return (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    );
  }

  private version(ticket: {
    updatedAt: Date;
    comments: Array<{ id: number }>;
    _count: { comments: number };
  }) {
    return `${ticket.updatedAt.toISOString()}:${ticket.comments[0]?.id ?? 0}:${ticket._count.comments}`;
  }

  async generate(
    ticketId: number,
    task: AiTask,
    actor: CurrentUserPayload,
  ): Promise<AiDraft> {
    this.assertStaff(actor);
    if (!this.provider.status().enabled)
      throw new ServiceUnavailableException(
        'AI chưa được cấu hình trên máy chủ.',
      );
    const ticket = await this.ticket(ticketId);
    if (task === AiTask.ARTICLE && !this.isResolved(ticket))
      throw new UnprocessableEntityException(
        'Chỉ tạo bài hướng dẫn từ ticket đã giải quyết hoặc đã đóng.',
      );

    const suggestions =
      task === AiTask.SUMMARY
        ? []
        : await this.knowledge.suggestForTicket(
            {
              title: ticket.title.slice(0, 150),
              description: ticket.description.slice(0, 3000),
            },
            actor,
          );
    const sources = suggestions.length
      ? await this.prisma.knowledgeArticle.findMany({
          where: {
            id: { in: suggestions.slice(0, 3).map((source) => source.id) },
            isPublished: true,
          },
          select: sourceSelect,
          take: 3,
          orderBy: { id: 'asc' },
        })
      : [];
    if (task === AiTask.REPLY && !sources.length)
      throw new UnprocessableEntityException(
        'Chưa có bài kiến thức đã xuất bản phù hợp. Vui lòng soạn câu trả lời thủ công.',
      );

    const truncated =
      ticket._count.comments > MAX_COMMENTS ||
      ticket.description.length > 6000 ||
      ticket.title.length > 150 ||
      ticket.comments.some((comment) => comment.content.length > 1200) ||
      sources.some(
        (source) =>
          source.content.length > 4000 ||
          source.title.length > 150 ||
          (source.summary?.length ?? 0) > 300,
      );
    const context = {
      includedComments: ticket.comments.length,
      totalComments: ticket._count.comments,
      truncated,
    };
    const input = {
      task,
      ticket: {
        title: redactAiText(ticket.title.slice(0, 150)),
        description: redactAiText(ticket.description.slice(0, 6000)),
        status: ticket.status,
        priority: ticket.priority,
      },
      comments: [...ticket.comments].reverse().map((comment) => ({
        role: comment.author.role,
        at: comment.createdAt.toISOString(),
        content: redactAiText(comment.content.slice(0, 1200)),
      })),
      sources: sources.map((source) => ({
        id: source.id,
        title: redactAiText(source.title.slice(0, 150)),
        summary: redactAiText((source.summary ?? '').slice(0, 300)),
        content: redactAiText(source.content.slice(0, 4000)),
      })),
      context,
    };
    return this.limiter.run(actor.userId, async () => {
      const generated = await this.provider.generate(task, input);
      if (
        generated.draft.sourceIds.some(
          (id) => !sources.some((source) => source.id === id),
        ) ||
        (task === AiTask.REPLY && !generated.draft.sourceIds.length)
      )
        throw new BadGatewayException(
          'AI dẫn nguồn không hợp lệ. Vui lòng thử lại hoặc soạn thủ công.',
        );

      // Permissions and source visibility may change while the provider runs.
      const sourceVersions: Promise<Array<{ id: number; updatedAt: Date }>> =
        sources.length
          ? this.prisma.knowledgeArticle.findMany({
              where: {
                id: { in: sources.map((source) => source.id) },
                isPublished: true,
              },
              select: { id: true, updatedAt: true },
            })
          : Promise.resolve([]);
      const [currentUser, currentTicket, currentSources] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: actor.userId },
          select: {
            role: true,
            isActive: true,
            isLocked: true,
            mustChangePassword: true,
          },
        }),
        this.prisma.ticket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            updatedAt: true,
            comments: {
              take: 1,
              orderBy: { id: 'desc' },
              select: { id: true },
            },
            _count: { select: { comments: true } },
          },
        }),
        sourceVersions,
      ]);
      if (
        !currentUser?.isActive ||
        currentUser.isLocked ||
        currentUser.mustChangePassword ||
        (currentUser.role !== UserRole.ADMIN &&
          currentUser.role !== UserRole.IT_STAFF)
      )
        throw new ForbiddenException(
          'Quyền sử dụng AI đã thay đổi. Vui lòng tải lại trang.',
        );
      if (!currentTicket) throw new NotFoundException('Không tìm thấy ticket.');
      if (
        this.version(currentTicket) !== this.version(ticket) ||
        (task === AiTask.ARTICLE && !this.isResolved(currentTicket))
      )
        throw new ConflictException(
          'Ticket đã thay đổi trong lúc AI xử lý. Kiểm tra thông tin mới trước khi tạo lại.',
        );
      if (
        sources.some(
          (source) =>
            !currentSources.some(
              (current) =>
                current.id === source.id &&
                current.updatedAt.getTime() === source.updatedAt.getTime(),
            ),
        )
      )
        throw new ConflictException(
          'Nguồn kiến thức đã thay đổi. Vui lòng tạo lại bản nháp.',
        );

      this.logger.log({
        event: 'ai_draft_generated',
        userId: actor.userId,
        ticketId,
        task,
        model: generated.model,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        sourceIds: generated.draft.sourceIds,
        truncated,
      });
      return {
        ...generated.draft,
        task,
        ticketId,
        model: generated.model,
        generatedAt: new Date().toISOString(),
        sources: sources
          .filter((source) => generated.draft.sourceIds.includes(source.id))
          .map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
        context,
      };
    });
  }
}
