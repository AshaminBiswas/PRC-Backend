import { z } from 'zod';

export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.string().optional(),
  type: z.enum(['customer', 'admin', 'all']).optional(),
  excludeStaff: z.coerce.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  gstin: z.string().max(15).optional().or(z.literal('')),
  roleId: z.string().uuid('Invalid role ID'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  mustChangePassword: z.boolean().optional().default(false),
  sendWelcomeEmail: z.boolean().optional().default(true),
});

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  gstin: z.string().max(15).optional().or(z.literal('')),
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional().nullable().or(z.literal('')),
  gstin: z.string().max(15).optional().nullable().or(z.literal('')),
});

export const UpdateAvatarSchema = z.object({
  avatar: z.string().min(1, 'Avatar URL is required'),
});

export const UpdateUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1, 'At least one role is required'),
});

export const ActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const CreateAddressSchema = z
  .object({
    label: z.string().optional(),
    type: z.enum(['BILLING', 'SHIPPING']).default('SHIPPING').optional(),
    addressLine1: z.string().optional(),
    line1: z.string().optional(),
    addressLine2: z.string().optional().nullable(),
    line2: z.string().optional().nullable(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    postalCode: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().default('India').optional(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal('')),
    altPhone: z.string().optional().nullable(),
    hasWhatsapp: z.boolean().default(false).optional(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    isDefault: z.boolean().default(false).optional(),
  })
  .refine((data) => data.addressLine1 || data.line1, {
    message: 'Address line is required',
    path: ['addressLine1'],
  })
  .refine((data) => data.postalCode || data.pincode, {
    message: 'Postal code / pincode is required',
    path: ['postalCode'],
  });

export const UpdateAddressSchema = z.object({
  label: z.string().optional(),
  type: z.enum(['BILLING', 'SHIPPING']).optional(),
  addressLine1: z.string().optional(),
  line1: z.string().optional(),
  addressLine2: z.string().optional().nullable(),
  line2: z.string().optional().nullable(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  postalCode: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  altPhone: z.string().optional().nullable(),
  hasWhatsapp: z.boolean().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const AddressIdParamSchema = z.object({
  addressId: z.string().uuid('Invalid address ID'),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;

