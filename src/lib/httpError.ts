export type HttpError = Error & { statusCode: number }

export function httpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  return error
}
