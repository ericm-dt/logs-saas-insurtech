import { Policy } from '../types/insuretech.types';
import { prisma } from '../config/database';

class PolicyModel {
  async create(policyData: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    const policy = await prisma.policy.create({
      data: {
        policyNumber: policyData.policyNumber,
        customerId: policyData.customerId,
        type: policyData.type,
        status: policyData.status,
        premium: policyData.premium,
        coverage: policyData.coverage,
        startDate: policyData.startDate,
        endDate: policyData.endDate,
      },
    });

    return policy as Policy;
  }

  async findById(id: string): Promise<Policy | undefined> {
    const policy = await prisma.policy.findUnique({
      where: { id },
    });

    return policy ? (policy as Policy) : undefined;
  }

  async findByCustomerId(customerId: string): Promise<Policy[]> {
    const policies = await prisma.policy.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return policies as Policy[];
  }

  async findByPolicyNumber(policyNumber: string): Promise<Policy | undefined> {
    const policy = await prisma.policy.findUnique({
      where: { policyNumber },
    });

    return policy ? (policy as Policy) : undefined;
  }

  async update(id: string, updates: Partial<Policy>): Promise<Policy | undefined> {
    try {
      const policy = await prisma.policy.update({
        where: { id },
        data: updates,
      });

      return policy as Policy;
    } catch (error) {
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.policy.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async findAll(): Promise<Policy[]> {
    const policies = await prisma.policy.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return policies as Policy[];
  }
}

export const policyModel = new PolicyModel();
