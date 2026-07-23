import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateKnowledgeArticleDto } from './dto/create-knowledge-article.dto';
import { UpdateKnowledgeArticleDto } from './dto/update-knowledge-article.dto';
import { GetKnowledgeQueryDto } from './dto/get-knowledge-query.dto';
import { SuggestArticlesDto } from './dto/suggest-articles.dto';

type CurrentUser = {
  userId: number;
  role: UserRole;
};

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  private createSlug(title: string) {
    return title
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(title: string, ignoreId?: number) {
    const baseSlug = this.createSlug(title);

    if (!baseSlug) {
      throw new BadRequestException('Title must contain valid characters');
    }

    let slug = baseSlug;
    let suffix = 2;

    while (true) {
      const existedArticle = await this.prisma.knowledgeArticle.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existedArticle || existedArticle.id === ignoreId) {
        return slug;
      }

      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }
  }

  private buildReadScope(
    currentUser: CurrentUser,
  ): Prisma.KnowledgeArticleWhereInput {
    if (currentUser.role === UserRole.ADMIN) {
      return {};
    }

    if (currentUser.role === UserRole.IT_STAFF) {
      return {
        OR: [
          {
            isPublished: true,
          },
          {
            createdById: currentUser.userId,
          },
        ],
      };
    }

    return {
      isPublished: true,
    };
  }

  async create(createDto: CreateKnowledgeArticleDto, currentUser: CurrentUser) {
    const slug = await this.generateUniqueSlug(createDto.title);

    const article = await this.prisma.knowledgeArticle.create({
      data: {
        title: createDto.title,
        slug,
        summary: createDto.summary,
        content: createDto.content,
        tags: createDto.tags,
        isPublished: createDto.isPublished ?? false,
        createdById: currentUser.userId,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        tags: true,
        isPublished: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return article;
  }

  async findAll(currentUser: CurrentUser, query: GetKnowledgeQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.KnowledgeArticleWhereInput = {
      ...this.buildReadScope(currentUser),
    };

    if (query.keyword) {
      where.OR = [
        {
          title: {
            contains: query.keyword,
          },
        },
        {
          summary: {
            contains: query.keyword,
          },
        },
        {
          content: {
            contains: query.keyword,
          },
        },
      ];
    }

    if (query.tag) {
      where.tags = {
        contains: query.tag,
      };
    }

    if (
      typeof query.isPublished === 'boolean' &&
      currentUser.role === UserRole.ADMIN
    ) {
      where.isPublished = query.isPublished;
    }

    const [articles, totalItems] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          tags: true,
          isPublished: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.knowledgeArticle.count({ where }),
    ]);

    return {
      items: articles,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async getById(id: number, currentUser: CurrentUser) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        tags: true,
        isPublished: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const canRead =
      currentUser.role === UserRole.ADMIN ||
      article.isPublished ||
      (currentUser.role === UserRole.IT_STAFF &&
        article.createdById === currentUser.userId);

    if (!canRead) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.knowledgeArticle.update({
      where: {
        id,
      },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    return article;
  }

  async update(
    id: number,
    updateDto: UpdateKnowledgeArticleDto,
    currentUser: CurrentUser,
  ) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const canUpdate =
      currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.IT_STAFF &&
        article.createdById === currentUser.userId);

    if (!canUpdate) {
      throw new ForbiddenException('Forbidden');
    }

    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const data: Prisma.KnowledgeArticleUpdateInput = {
      ...updateDto,
    };

    if (updateDto.title !== undefined) {
      const title = updateDto.title.trim();

      data.title = title;
      data.slug = await this.generateUniqueSlug(title, id);
    }

    return this.prisma.knowledgeArticle.update({
      where: {
        id,
      },
      data,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        tags: true,
        isPublished: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async publish(id: number, currentUser: CurrentUser) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const canPublish =
      currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.IT_STAFF &&
        article.createdById === currentUser.userId);

    if (!canPublish) {
      throw new ForbiddenException('Forbidden');
    }

    return this.prisma.knowledgeArticle.update({
      where: {
        id,
      },
      data: {
        isPublished: true,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        content: true,
        tags: true,
        isPublished: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async remove(id: number, currentUser: CurrentUser) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        createdById: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const canDelete =
      currentUser.role === UserRole.ADMIN ||
      (currentUser.role === UserRole.IT_STAFF &&
        article.createdById === currentUser.userId);

    if (!canDelete) {
      throw new ForbiddenException('Forbidden');
    }

    return this.prisma.knowledgeArticle.delete({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });
  }

  async suggestForTicket(
    suggestDto: SuggestArticlesDto,
    currentUser: CurrentUser,
  ) {
    const text = `${suggestDto.title} ${suggestDto.description ?? ''}`;
    const keywords = Array.from(
      new Set(
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter((keyword) => keyword.length > 3),
      ),
    ).slice(0, 8);

    if (keywords.length === 0) {
      return [];
    }

    return this.prisma.knowledgeArticle.findMany({
      where: {
        ...this.buildReadScope(currentUser),
        isPublished: true,
        OR: keywords.flatMap((keyword) => [
          {
            title: {
              contains: keyword,
            },
          },
          {
            content: {
              contains: keyword,
            },
          },
          {
            tags: {
              contains: keyword,
            },
          },
        ]),
      },
      take: 5,
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        tags: true,
        viewCount: true,
        updatedAt: true,
      },
    });
  }
}
