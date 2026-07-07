export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  status?: number;
  errors?: unknown;
};

export type ApiErrorResponse = {
  success?: false;
  message?: string;
  status?: number;
  error?: unknown;
  errors?: unknown;
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

export type PaginatedResponse<T> = PaginatedApiResponse<T>;
