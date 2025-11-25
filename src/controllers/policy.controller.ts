import { Request, Response } from 'express';
import { policyModel } from '../models/policy.model';
import { sendSuccess, sendError, ApiError } from '../utils/response';
import { AuthRequest } from '../types/express.types';
import { PolicyType, PolicyStatus } from '../types/insuretech.types';

export class PolicyController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { policyNumber, customerId, type, premium, coverage, startDate, endDate } = req.body;

      const policy = await policyModel.create({
        policyNumber,
        customerId,
        type: type as PolicyType,
        status: PolicyStatus.PENDING,
        premium,
        coverage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      sendSuccess(res, policy, 'Policy created successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to create policy', 500);
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const policies = await policyModel.findAll();
      sendSuccess(res, policies);
    } catch (error) {
      sendError(res, 'Failed to fetch policies', 500);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const policy = await policyModel.findById(id);

      if (!policy) {
        sendError(res, 'Policy not found', 404);
        return;
      }

      sendSuccess(res, policy);
    } catch (error) {
      sendError(res, 'Failed to fetch policy', 500);
    }
  }

  async getByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const policies = await policyModel.findByCustomerId(customerId);
      sendSuccess(res, policies);
    } catch (error) {
      sendError(res, 'Failed to fetch customer policies', 500);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const policy = await policyModel.update(id, updates);

      if (!policy) {
        sendError(res, 'Policy not found', 404);
        return;
      }

      sendSuccess(res, policy, 'Policy updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update policy', 500);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await policyModel.delete(id);

      if (!deleted) {
        sendError(res, 'Policy not found', 404);
        return;
      }

      sendSuccess(res, null, 'Policy deleted successfully');
    } catch (error) {
      sendError(res, 'Failed to delete policy', 500);
    }
  }
}

export const policyController = new PolicyController();
