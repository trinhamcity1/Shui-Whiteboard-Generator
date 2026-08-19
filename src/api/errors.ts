export class ApiError extends Error {
  statusCode: number;
  detail: string | Array<{ loc: (string | number)[]; msg: string }>;

  constructor(statusCode: number, detail: string | Array<{ loc: (string | number)[]; msg: string }>) {
    super(typeof detail === "string" ? detail : "Validation failed.");
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}
