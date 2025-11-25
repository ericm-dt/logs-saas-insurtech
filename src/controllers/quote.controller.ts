import { Request, Response } from 'express';
import { quoteModel } from '../models/quote.model';
import { sendSuccess, sendError } from '../utils/response';
import { PolicyType, QuoteStatus } from '../types/insuretech.types';

export class QuoteController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, type, coverage } = req.body;

      // Simple premium calculation based on coverage
      const baseRate = 0.015; // 1.5% of coverage
      const estimatedPremium = coverage * baseRate;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Quote valid for 30 days

      const quote = await quoteModel.create({
        customerId,
        type: type as PolicyType,
        coverage,
        estimatedPremium,
        status: QuoteStatus.ACTIVE,
        expiresAt,
      });

      sendSuccess(res, quote, 'Quote generated successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to generate quote', 500);
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const quotes = await quoteModel.findAll();
      sendSuccess(res, quotes);
    } catch (error) {
      sendError(res, 'Failed to fetch quotes', 500);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quote = await quoteModel.findById(id);

      if (!quote) {
        sendError(res, 'Quote not found', 404);
        return;
      }

      sendSuccess(res, quote);
    } catch (error) {
      sendError(res, 'Failed to fetch quote', 500);
    }
  }

  async getByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const quotes = await quoteModel.findByCustomerId(customerId);
      sendSuccess(res, quotes);
    } catch (error) {
      sendError(res, 'Failed to fetch customer quotes', 500);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const quote = await quoteModel.update(id, updates);

      if (!quote) {
        sendError(res, 'Quote not found', 404);
        return;
      }

      sendSuccess(res, quote, 'Quote updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update quote', 500);
    }
  }
}

export const quoteController = new QuoteController();
