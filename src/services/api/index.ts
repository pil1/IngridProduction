// Base classes and types
export { BaseApiService, ApiError, type ApiResponse } from './base';
export * from './types';

// Service instances
export { expenseService } from './expense';
export { userService } from './user';
export { companyService } from './company';

// Service classes (for testing or custom instances)
export { ExpenseService } from './expense';
export { UserService } from './user';
export { CompanyService } from './company';

// Type exports for service-specific interfaces
export type {
  CreateProfileRequest,
  UpdateProfileRequest,
  InviteUserRequest
} from './user';

export type {
  CreateCompanyRequest,
  UpdateCompanyRequest,
  CompanySettings
} from './company';