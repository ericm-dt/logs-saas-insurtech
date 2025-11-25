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
