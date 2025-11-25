export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  CUSTOMER = 'customer',
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  phone: string;
  address: Address;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Policy {
  id: string;
  policyNumber: string;
  customerId: string;
  type: PolicyType;
  status: PolicyStatus;
  premium: number;
  coverage: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum PolicyType {
  AUTO = 'auto',
  HOME = 'home',
  LIFE = 'life',
  HEALTH = 'health',
  BUSINESS = 'business',
}

export enum PolicyStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  customerId: string;
  type: string;
  status: ClaimStatus;
  amount: number;
  description: string;
  dateOfIncident: Date;
  dateReported: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum ClaimStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  DENIED = 'denied',
  PAID = 'paid',
}

export interface Quote {
  id: string;
  customerId: string;
  type: PolicyType;
  coverage: number;
  estimatedPremium: number;
  status: QuoteStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum QuoteStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}
