export interface UserContext {
  id: string;
  email: string;
  roleSlug: string;
  permissions: string[];
  ventureId?: string;
}

export interface VentureContext extends UserContext {
  ventureId: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  ventureId?: string;
  warehouseId?: string;
  format?: 'csv' | 'xlsx' | 'json';
}
