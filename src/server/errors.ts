
export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthenticated: please log in", details?: unknown) {
    super(401, "UNAUTHORIZED", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden: you do not have permission to access this resource", details?: unknown) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict with current state", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation Error", details?: unknown) {
    super(422, "VALIDATION_ERROR", message, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Internal Server Error", details?: unknown) {
    super(500, "INTERNAL_SERVER_ERROR", message, details);
  }
}

export function formatApiError(
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    message,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
