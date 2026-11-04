/**
 * Shared request-validation helpers.
 *
 * Inputs are validated with Fastify JSON schemas (Ajv). Schemas validate the
 * RAW client body / querystring, i.e. before the auth gate wraps the body into
 * { data, user }. Type coercion is disabled in server.ts, so a number sent for
 * a string field is rejected instead of being silently stringified.
 *
 * Validation failures are answered with HTTP 400 and the usual response
 * envelope { status: "ERROR", data: null, message }. A route can keep its own
 * wording by setting `config.validationMessage` (a string, or a function of
 * the offending field name).
 */

/** A string that contains at least one non-whitespace character. */
export const nonBlankString = { type: "string", pattern: "\\S" } as const;

/** An optional string (used for querystring filters). */
export const optionalString = { type: "string" } as const;

export function objectSchema(properties: Record<string, any>, required: string[] = []) {
  return { type: "object", properties, required };
}

export type ValidationMessage = string | ((field: string) => string);

/** Extracts the offending field name from an Ajv error. */
function fieldOf(err: any): string {
  if (err?.params?.missingProperty) return String(err.params.missingProperty);
  const path: string = err?.instancePath ?? "";
  return path.replace(/^\//, "").split("/")[0] || "";
}

/** Root error handler: 400 + envelope for schema errors, default handling otherwise. */
export function errorHandler(error: any, req: any, reply: any) {
  if (error?.validation) {
    const custom: ValidationMessage | undefined = req.routeOptions?.config?.validationMessage;
    const field = fieldOf(error.validation[0]);
    const message =
      typeof custom === "function"
        ? custom(field)
        : typeof custom === "string"
          ? custom
          : `Invalid Input : ${error.message}`;
    return reply.code(400).send({ status: "ERROR", data: null, message });
  }
  reply.send(error);
}

/** Escapes LIKE/ILIKE metacharacters so user input is matched literally (Postgres default escape is "\"). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
