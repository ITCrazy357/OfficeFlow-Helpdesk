export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  status?: number;
};

export type ApiErrorResponse = {
  success?: false;
  message?: string;
  status?: number;
  error?: unknown;
};

export type Pagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedData<T> = {
  data: T[];
  pagination: Pagination;
};

export type PaginatedApiResponse<T> = ApiResponse<PaginatedData<T>>;
