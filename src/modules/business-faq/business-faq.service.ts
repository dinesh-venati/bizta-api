import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export interface FaqSnippet {
  question: string;
  answer: string;
  tags: string[];
}

@Injectable()
export class BusinessFaqService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get FAQ snippets for an organization (active only)
   * @param orgId Organization ID
   * @param limit Maximum number of FAQs to return (default 10)
   * @returns Array of FAQ snippets
   */
  async getFaqSnippetsForOrg(orgId: string, limit: number = 10): Promise<FaqSnippet[]> {
    const faqs = await this.prisma.businessFaq.findMany({
      where: {
        orgId,
        isActive: true,
      },
      select: {
        question: true,
        answer: true,
        tags: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return faqs;
  }

  /**
   * Search FAQs by keyword or tag
   * @param orgId Organization ID
   * @param searchTerm Search term for questions/answers
   * @param limit Maximum number of results
   * @returns Array of FAQ snippets
   */
  async searchFaqs(orgId: string, searchTerm: string, limit: number = 5): Promise<FaqSnippet[]> {
    const faqs = await this.prisma.businessFaq.findMany({
      where: {
        orgId,
        isActive: true,
        OR: [
          {
            question: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            answer: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            tags: {
              has: searchTerm.toLowerCase(),
            },
          },
        ],
      },
      select: {
        question: true,
        answer: true,
        tags: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });

    return faqs;
  }
}
