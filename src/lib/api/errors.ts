export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function toErrorBody(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}
