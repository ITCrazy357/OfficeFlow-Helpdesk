export type ApiResponse<T> = {
  success: boolean;
  statusCode?: number;
  message: string;
  data: T;
  errors?: unknown;
};

export type ApiErrorResponse = {
  success?: false;
  statusCode?: number;
  message?: string;
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
  items: T[];
  pagination: Pagination;
};

export type PaginatedApiResponse<T> = ApiResponse<PaginatedData<T>>;

export type PaginatedResponse<T> = PaginatedApiResponse<T>;
