import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  //   BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { OrgsService } from '../orgs/orgs.service';
import { RegisterDto, LoginDto } from './dto';
import { JwtPayload, AuthResponse } from './interfaces/auth.interface';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly orgsService: OrgsService,
  ) {}

  /**
   * Register a new user with a default organization
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.encryptionService.hashPassword(password);

    // Create user and organization in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
        },
      });

      // Create default organization with settings
      const orgName = `${firstName}'s Organization`;
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug: await this.generateUniqueSlug(orgName, tx),
          memberships: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
          settings: {
            create: {
              agentName: 'Bizta',
              businessName: orgName,
              autoReply: true,
              autoFollowup: true,
              dailySummaryEnabled: true,
              dailySummaryTime: '09:00',
              timezone: 'UTC',
              maxAutoRepliesPerDay: 100,
            },
          },
        },
        include: {
          settings: true,
        },
      });

      return { user, org };
    });

    // Generate tokens
    const tokens = await this.generateTokens(result.user, result.org.id, 'OWNER');

    return {
      ...tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
      },
    };
  }

  /**
   * Login user and return tokens
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: {
            organization: {
              isActive: true,
            },
          },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          include: {
            organization: true,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.encryptionService.verifyPassword(user.password, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has any active organization
    if (!user.memberships || user.memberships.length === 0) {
      throw new UnauthorizedException('No active organization found');
    }

    const membership = user.memberships[0];
    const org = membership.organization;

    // Generate tokens
    const tokens = await this.generateTokens(user, org.id, membership.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Verify user still exists and has access to org
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify membership still exists
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_orgId: {
            userId: payload.sub,
            orgId: payload.orgId,
          },
        },
      });

      if (!membership) {
        throw new UnauthorizedException('Organization access revoked');
      }

      // Generate new access token
      const accessToken = await this.generateAccessToken({
        sub: payload.sub,
        email: payload.email,
        orgId: payload.orgId,
        role: membership.role,
      });

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get current user with org info
   */
  async getCurrentUser(userId: string, orgId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId,
          orgId,
        },
      },
      include: {
        organization: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedException('Organization access not found');
    }

    return {
      user,
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        isActive: membership.organization.isActive,
      },
      role: membership.role,
      settings: membership.organization.settings,
    };
  }

  /**
   * Validate JWT payload and return user
   */
  async validateUser(payload: JwtPayload): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
    orgId: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId,
      role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token (short-lived)
   */
  private async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  private async generateRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
    });
  }

  /**
   * Generate unique slug for organization
   */
  private async generateUniqueSlug(name: string, tx: any): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await tx.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
