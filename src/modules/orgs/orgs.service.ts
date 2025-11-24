import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Organization } from '@prisma/client';

@Injectable()
export class OrgsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new organization with default settings
   */
  async create(name: string, ownerId: string): Promise<Organization> {
    // Generate slug from name
    const slug = this.generateSlug(name);

    const org = await this.prisma.organization.create({
      data: {
        name,
        slug: await this.ensureUniqueSlug(slug),
        memberships: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
        settings: {
          create: {
            agentName: 'Bizta',
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
        memberships: true,
        settings: true,
      },
    });

    return org;
  }

  /**
   * Get organization by ID with membership check
   */
  async findById(orgId: string, userId: string): Promise<Organization | null> {
    return this.prisma.organization.findFirst({
      where: {
        id: orgId,
        memberships: {
          some: {
            userId,
          },
        },
      },
      include: {
        settings: true,
        memberships: {
          where: { userId },
          include: { user: true },
        },
      },
    });
  }

  /**
   * Get user's primary organization (first OWNER role, or first membership)
   */
  async getPrimaryOrg(userId: string): Promise<Organization | null> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organization: {
          isActive: true,
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }], // OWNER comes first
      include: {
        organization: {
          include: {
            settings: true,
          },
        },
      },
    });

    return membership?.organization || null;
  }

  /**
   * Get user's role in an organization
   */
  async getUserRole(userId: string, orgId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId,
          orgId,
        },
      },
    });

    return membership?.role || null;
  }

  /**
   * Generate slug from organization name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Ensure slug is unique by appending number if needed
   */
  private async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
