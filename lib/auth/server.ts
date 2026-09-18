import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import { CognitoJwtVerifier } from "aws-jwt-verify";

/**
 * Server-side Cognito identity. The browser sends its Cognito *access token*
 * as `Authorization: Bearer …`; we verify signature/issuer/audience/expiry
 * against the pool's JWKS and expose the `sub`. Database ownership is always
 * derived from this value - never from anything the client sends in a body.
 */
export interface ServerUser {
  sub: string;
  username: string;
}

const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID ?? "";

declare global {
  // eslint-disable-next-line no-var
  var __matanJwtVerifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;
  // eslint-disable-next-line no-var
  var __matanUserContext: AsyncLocalStorage<ServerUser> | undefined;
}

function verifier() {
  if (!POOL_ID || !CLIENT_ID) return null;
  if (!globalThis.__matanJwtVerifier) globalThis.__matanJwtVerifier = CognitoJwtVerifier.create({ userPoolId: POOL_ID, tokenUse: "access", clientId: CLIENT_ID });
  return globalThis.__matanJwtVerifier;
}

function context() {
  if (!globalThis.__matanUserContext) globalThis.__matanUserContext = new AsyncLocalStorage<ServerUser>();
  return globalThis.__matanUserContext;
}

export class AuthRequiredError extends Error {
  status = 401 as const;
  code: "AUTH_REQUIRED" | "AUTH_INVALID" | "AUTH_NOT_CONFIGURED";
  constructor(code: AuthRequiredError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** Verify the bearer token on a request. Throws AuthRequiredError (401) when missing/invalid. */
export async function requireUser(req: Request): Promise<ServerUser> {
  const v = verifier();
  if (!v) throw new AuthRequiredError("AUTH_NOT_CONFIGURED", "Authentication is not configured on the server.");
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new AuthRequiredError("AUTH_REQUIRED", "Sign in to continue.");
  try {
    const payload = await v.verify(token);
    return { sub: payload.sub, username: String(payload.username ?? payload["cognito:username"] ?? payload.sub) };
  } catch {
    throw new AuthRequiredError("AUTH_INVALID", "Your session is no longer valid. Sign in again.");
  }
}

/** Run `fn` with `user` as the ambient identity (route handlers and background jobs). */
export function withUser<T>(user: ServerUser, fn: () => Promise<T>): Promise<T> {
  return context().run(user, fn);
}

/** Ambient identity for the current request/job, or null outside an authenticated scope. */
export function currentUser(): ServerUser | null {
  return context().getStore() ?? null;
}

/** Ambient Cognito sub; throws when code that must be user-scoped runs without one. */
export function currentUserSub(): string {
  const u = currentUser();
  if (!u) throw new AuthRequiredError("AUTH_REQUIRED", "No authenticated user in scope.");
  return u.sub;
}

export function authErrorResponse(e: AuthRequiredError) {
  return NextResponse.json({ error: { code: e.code, title: "Sign in required", message: e.message } }, { status: 401 });
}

type Handler<C> = (req: Request, ctx: C, user: ServerUser) => Promise<Response>;

/**
 * Wrap a route handler so it only runs for an authenticated Cognito user, with
 * the identity available ambiently (`currentUserSub()`) and per-user caches
 * hydrated from DynamoDB.
 */
export function authed<C = unknown>(handler: Handler<C>, opts: { hydrate?: (user: ServerUser) => Promise<void> } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    let user: ServerUser;
    try {
      user = await requireUser(req);
    } catch (e) {
      if (e instanceof AuthRequiredError) return authErrorResponse(e);
      throw e;
    }
    return withUser(user, async () => {
      if (opts.hydrate) await opts.hydrate(user);
      return handler(req, ctx, user);
    });
  };
}
