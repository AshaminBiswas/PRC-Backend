import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required').max(200),
  clientName: z.string().min(2, 'Client name is required').max(200),
  location: z.string().max(200).optional().nullable(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  region: z.string().max(100).optional().nullable(),
  isPanIndia: z.boolean().optional().default(false),
  category: z.string().min(2, 'Category is required').max(100).default('Commercial'),
  description: z.string().max(2000).optional().nullable(),
  completionYear: z.string().max(50).optional().nullable(),
  productsUsed: z.union([z.array(z.string()), z.string()]).optional().default([]),
  images: z.array(z.string().url('Must be a valid image URL')).min(2, 'At least 2 project images are required'),
  videoUrl: z.string().url('Must be a valid video URL').optional().nullable().or(z.literal('')),
  isFeatured: z.boolean().optional().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  orderIndex: z.number().int().optional().default(0),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const ListProjectsQuerySchema = z.object({
  search: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  category: z.string().optional(),
  isPanIndia: z.string().optional(),
  isFeatured: z.string().optional(),
  status: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sort: z.enum(['newest', 'oldest', 'name', 'order']).optional().default('order'),
});

export const ProjectIdParamSchema = z.object({
  id: z.string().uuid('Invalid project ID'),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;
