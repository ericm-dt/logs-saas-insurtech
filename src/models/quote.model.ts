import { Quote } from '../types/insuretech.types';
import { prisma } from '../config/database';

class QuoteModel {
  async create(quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quote> {
    const quote = await prisma.quote.create({
      data: {
        customerId: quoteData.customerId,
        type: quoteData.type,
        coverage: quoteData.coverage,
        estimatedPremium: quoteData.estimatedPremium,
        status: quoteData.status,
        expiresAt: quoteData.expiresAt,
      },
    });

    return quote as Quote;
  }

  async findById(id: string): Promise<Quote | undefined> {
    const quote = await prisma.quote.findUnique({
      where: { id },
    });

    return quote ? (quote as Quote) : undefined;
  }

  async findByCustomerId(customerId: string): Promise<Quote[]> {
    const quotes = await prisma.quote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return quotes as Quote[];
  }

  async update(id: string, updates: Partial<Quote>): Promise<Quote | undefined> {
    try {
      const quote = await prisma.quote.update({
        where: { id },
        data: updates,
      });

      return quote as Quote;
    } catch (error) {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.quote.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async findAll(): Promise<Quote[]> {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return quotes as Quote[];
  }
}

export const quoteModel = new QuoteModel();
