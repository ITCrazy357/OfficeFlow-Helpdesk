import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto';

@Injectable()
export class TicketCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.ticketCategory.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.ticketCategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Ticket category not found');
    }

    return category;
  }

  async create(createDto: CreateTicketCategoryDto) {
    await this.ensureNameIsAvailable(createDto.name);

    return this.prisma.ticketCategory.create({
      data: {
        name: createDto.name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });
  }

  async update(id: number, updateDto: UpdateTicketCategoryDto) {
    await this.findOne(id);

    if (Object.keys(updateDto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    if (updateDto.name !== undefined) {
      await this.ensureNameIsAvailable(updateDto.name, id);
    }

    return this.prisma.ticketCategory.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    const category = await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.ticket.updateMany({
        where: {
          categoryId: id,
        },
        data: {
          categoryId: null,
        },
      }),
      this.prisma.ticketCategory.delete({
        where: { id },
      }),
    ]);

    return {
      id,
      detachedTickets: category._count.tickets,
    };
  }

  private async ensureNameIsAvailable(name: string, ignoreId?: number) {
    const existingCategory = await this.prisma.ticketCategory.findFirst({
      where: {
        name,
        ...(ignoreId
          ? {
              id: {
                not: ignoreId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Ticket category name already exists');
    }
  }
}
