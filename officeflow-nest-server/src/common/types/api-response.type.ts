export type ApiSuccessResponse<T> = {
  success: true;
  statusCode: number;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown;
  path: string;
  timestamp: string;
};
