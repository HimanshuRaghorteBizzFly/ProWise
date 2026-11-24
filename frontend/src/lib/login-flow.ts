import { ApiError, type AuthLoginResponse } from "@/lib/api";

/**
 * Sign-in succeeds only on a real 200 from the backend. There is no client-side fallback session: a refusal shows
 * the server's message and an unreachable server shows CANNOT_REACH_SERVER_MESSAGE.
 */
export const CANNOT_REACH_SERVER_MESSAGE =
  "Cannot reach the ProWise server. Check your connection and try again in a moment.";

export const LOGIN_TIMEOUT_CODE = "LOGIN_TIMEOUT";
const DEFAULT_LOGIN_TIMEOUT_MS = 15_000;

export type LoginAttempt =
  | { ok: true; response: AuthLoginResponse }
  | { ok: false; error: ApiError };

export async function attemptLogin(
  login: (body: { email: string; password: string }) => Promise<AuthLoginResponse>,
  email: string,
  password: string,
  timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS,
): Promise<LoginAttempt> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ApiError(0, LOGIN_TIMEOUT_CODE, CANNOT_REACH_SERVER_MESSAGE, "")),
      timeoutMs,
    );
  });
  try {
    const response = await Promise.race([login({ email, password }), timeout]);
    return { ok: true, response };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error };
    return {
      ok: false,
      error: new ApiError(0, "NETWORK_ERROR", error instanceof Error ? error.message : CANNOT_REACH_SERVER_MESSAGE, ""),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** True when no backend answer arrived (network failure, timeout, or the proxy could not reach the API). */
export function isServerUnreachable(error: ApiError): boolean {
  if (error.status === 0) return true;
  if (error.status === 502 || error.status === 503 || error.status === 504) return true;
  // A non-JSON 5xx comes from the dev proxy, not from the API's standard error shape.
  return error.status >= 500 && error.code.startsWith("HTTP_");
}

/** The message to show for a failed sign-in: the server's own message (with its reference) or "cannot reach". */
export function loginErrorMessage(error: ApiError): string {
  if (isServerUnreachable(error)) return CANNOT_REACH_SERVER_MESSAGE;
  return error.requestId ? `${error.message} (Reference: ${error.requestId})` : error.message;
}
