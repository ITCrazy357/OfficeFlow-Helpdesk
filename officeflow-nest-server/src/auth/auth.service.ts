import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { REFRESH_TOKEN_TTL_MS } from './auth-cookie';

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

class RefreshTokenRaceError extends Error {}

function generateRefreshToken() {
  return randomBytes(32).toString('base64url');
}

function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existedUser = await this.prisma.user.findUnique({
      where: {
        email: registerDto.email,
      },
    });

    if (existedUser) {
      throw new BadRequestException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: registerDto.name,
        email: registerDto.email,
        passwordHash,
        departmentId: registerDto.departmentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        createdAt: true,
      },
    });

    return user;
  }
  async login(loginDto: LoginDto, metadata: RequestMetadata = {}) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Account is inactive');
    }

    const passwordMatch = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = await this.createRefreshSession(user.id, metadata);
    const accessToken = this.signAccessToken(user, session.id);

    return {
      accessToken,
      refreshToken: session.token,
      refreshTokenExpiresAt: session.expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async refresh(refreshToken: string, metadata: RequestMetadata = {}) {
    const tokenHash = hashRefreshToken(refreshToken);
    const currentToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!currentToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (currentToken.usedAt || currentToken.revokedAt) {
      await this.revokeTokenFamily(currentToken.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const now = new Date();

    if (currentToken.expiresAt <= now || !currentToken.user.isActive) {
      await this.revokeTokenFamily(currentToken.familyId);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const nextToken = generateRefreshToken();
    const nextTokenId = randomUUID();

    try {
      await this.prisma.$transaction(async (transaction) => {
        const claimedToken = await transaction.refreshToken.updateMany({
          where: {
            id: currentToken.id,
            tokenHash,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            usedAt: now,
            revokedAt: now,
            replacedById: nextTokenId,
          },
        });

        if (claimedToken.count !== 1) {
          throw new RefreshTokenRaceError();
        }

        await transaction.refreshToken.create({
          data: {
            id: nextTokenId,
            tokenHash: hashRefreshToken(nextToken),
            familyId: currentToken.familyId,
            userId: currentToken.userId,
            expiresAt: currentToken.expiresAt,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          },
        });
      });
    } catch (error) {
      if (error instanceof RefreshTokenRaceError) {
        await this.revokeTokenFamily(currentToken.familyId);
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      throw error;
    }

    return {
      accessToken: this.signAccessToken(currentToken.user, nextTokenId),
      refreshToken: nextToken,
      refreshTokenExpiresAt: currentToken.expiresAt,
    };
  }

  async logout(refreshToken: string | null) {
    if (!refreshToken) {
      return;
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(refreshToken) },
      select: { familyId: true },
    });

    if (storedToken) {
      await this.revokeTokenFamily(storedToken.familyId);
    }
  }

  async logoutAll(userId: number) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private signAccessToken(user: Pick<SessionUser, 'id' | 'role'>, sid: string) {
    return this.jwtService.sign({
      sub: user.id,
      sid,
      role: user.role,
    });
  }

  private async createRefreshSession(
    userId: number,
    metadata: RequestMetadata,
  ) {
    const token = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const id = randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        id,
        tokenHash: hashRefreshToken(token),
        familyId: randomUUID(),
        userId,
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    return { id, token, expiresAt };
  }

  private async revokeTokenFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
