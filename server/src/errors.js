export class AppError extends Error {
  constructor(message, code, statusCode = 500, details = undefined) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(details) {
    super("Validation failed", "VALIDATION_ERROR", 422, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}
