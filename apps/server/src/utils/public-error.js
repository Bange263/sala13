import { ERROR_CODES } from "@sala13/shared";

export class PublicError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "PublicError";
    this.code = code;
    this.details = details;
  }
}

export function toClientError(error) {
  if (error instanceof PublicError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    };
  }

  console.error(error);
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: "Errore interno del server. Riprova tra poco."
  };
}
