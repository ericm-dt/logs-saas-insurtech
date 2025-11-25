import { Claim } from '../types/insuretech.types';
import { prisma } from '../config/database';

class ClaimModel {
  async create(claimData: Omit<Claim, 'id' | 'createdAt' | 'updatedAt'>): Promise<Claim> {
    const claim = await prisma.claim.create({
      data: {
        claimNumber: claimData.claimNumber,
        policyId: claimData.policyId,
        customerId: claimData.customerId,
        type: claimData.type,
        status: claimData.status,
        amount: claimData.amount,
        description: claimData.description,
        dateOfIncident: claimData.dateOfIncident,
        dateReported: claimData.dateReported,
      },
    });

    return claim as Claim;
  }

  async findById(id: string): Promise<Claim | undefined> {
    const claim = await prisma.claim.findUnique({
      where: { id },
    });

    return claim ? (claim as Claim) : undefined;
  }

  async findByPolicyId(policyId: string): Promise<Claim[]> {
    const claims = await prisma.claim.findMany({
      where: { policyId },
      orderBy: { createdAt: 'desc' },
    });

    return claims as Claim[];
  }

  async findByCustomerId(customerId: string): Promise<Claim[]> {
    const claims = await prisma.claim.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return claims as Claim[];
  }

  async update(id: string, updates: Partial<Claim>): Promise<Claim | undefined> {
    try {
      const claim = await prisma.claim.update({
        where: { id },
        data: updates,
      });

      return claim as Claim;
    } catch (error) {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.claim.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async findAll(): Promise<Claim[]> {
    const claims = await prisma.claim.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return claims as Claim[];
  }
}

export const claimModel = new ClaimModel();
