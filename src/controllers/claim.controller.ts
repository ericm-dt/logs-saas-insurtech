import { Request, Response } from 'express';
import { claimModel } from '../models/claim.model';
import { sendSuccess, sendError } from '../utils/response';
import { ClaimStatus } from '../types/insuretech.types';

export class ClaimController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        claimNumber,
        policyId,
        customerId,
        type,
        amount,
        description,
        dateOfIncident,
      } = req.body;

      const claim = await claimModel.create({
        claimNumber,
        policyId,
        customerId,
        type,
        status: ClaimStatus.SUBMITTED,
        amount,
        description,
        dateOfIncident: new Date(dateOfIncident),
        dateReported: new Date(),
      });

      sendSuccess(res, claim, 'Claim submitted successfully', 201);
    } catch (error) {
      sendError(res, 'Failed to submit claim', 500);
    }
  }

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const claims = await claimModel.findAll();
      sendSuccess(res, claims);
    } catch (error) {
      sendError(res, 'Failed to fetch claims', 500);
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const claim = await claimModel.findById(id);

      if (!claim) {
        sendError(res, 'Claim not found', 404);
        return;
      }

      sendSuccess(res, claim);
    } catch (error) {
      sendError(res, 'Failed to fetch claim', 500);
    }
  }

  async getByPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { policyId } = req.params;
      const claims = await claimModel.findByPolicyId(policyId);
      sendSuccess(res, claims);
    } catch (error) {
      sendError(res, 'Failed to fetch policy claims', 500);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const claim = await claimModel.update(id, updates);

      if (!claim) {
        sendError(res, 'Claim not found', 404);
        return;
      }

      sendSuccess(res, claim, 'Claim updated successfully');
    } catch (error) {
      sendError(res, 'Failed to update claim', 500);
    }
  }
}

export const claimController = new ClaimController();
