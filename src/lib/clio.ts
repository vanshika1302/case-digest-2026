import { db } from "./db";
import { config } from "./config";

/*
 * Clio API client. READ-ONLY BY DESIGN: clioGet() is the only function that
 * calls the Clio REST API, and it only ever issues GET requests. The only POSTs
 * in this file go to /oauth/token, which is authentication, not case data.
 */

type TokenRow = { access_token: string; refresh_token: string | null; expires_at: number };

export class NotConnectedError extends Error {
  constructor() {
    super("Not connected to Clio. Visit /api/auth/login first.");
  }
}

export class ClioHttpError extends Error {
  constructor(public status: number, public body: string, url: string) {
    super(`Clio ${status} on ${url}: ${body.slice(0, 300)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function authorizeUrl(state: string): string {
  const url = new URL("/oauth/authorize", config.clioBase);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId());
  url.searchParams.set("redirect_uri", config.redirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

export function getTokens(): TokenRow | undefined {
  return db
    .prepare("SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE id = 1")
    .get() as TokenRow | undefined;
}

export const isConnected = () => getTokens() !== undefined;

async function tokenRequest(params: Record<string, string>): Promise<void> {
  const res = await fetch(new URL("/oauth/token", config.clioBase), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId(),
      client_secret: config.clientSecret(),
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`Clio token request failed: ${res.status} ${await res.text()}`);

  const token = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const previous = getTokens();
  db.prepare(
    `INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token,
       refresh_token = excluded.refresh_token, expires_at = excluded.expires_at`
  ).run(
    token.access_token,
    token.refresh_token ?? previous?.refresh_token ?? null,
    Date.now() + token.expires_in * 1000
  );
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri() });

async function accessToken(forceRefresh = false): Promise<string> {
  const tokens = getTokens();
  if (!tokens) throw new NotConnectedError();
  if (forceRefresh || tokens.expires_at - Date.now() < 60_000) {
    if (!tokens.refresh_token) throw new NotConnectedError();
    await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh_token });
    return getTokens()!.access_token;
  }
  return tokens.access_token;
}

type Params = Record<string, string | number | undefined>;

export async function clioGet(
  pathOrUrl: string,
  params: Params = {},
  options: { redirect?: RequestRedirect } = {}
): Promise<Response> {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`/api/v4/${pathOrUrl.replace(/^\//, "")}`, config.clioBase);
  // The bearer token must only ever go to Clio (absolute URLs come from paging links).
  if (url.origin !== new URL(config.clioBase).origin) throw new Error(`Refusing to send Clio credentials to ${url.origin}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let refreshed = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${await accessToken(false)}` },
      redirect: options.redirect ?? "follow",
    });

    if (res.status === 429) {
      const waitSeconds = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await sleep(waitSeconds * 1000);
      continue;
    }
    if (res.status === 401 && !refreshed) {
      refreshed = true;
      await accessToken(true);
      continue;
    }
    const isRedirect = res.status >= 300 && res.status < 400;
    if (!res.ok && !isRedirect) throw new ClioHttpError(res.status, await res.text(), url.toString());
    return res;
  }
  throw new Error(`Gave up on ${url} after repeated rate limiting`);
}

type ListPage<T> = { data: T[]; meta?: { paging?: { next?: string } } };

/** GET every page of a Clio list endpoint. */
export async function clioList<T>(path: string, params: Params = {}): Promise<T[]> {
  const results: T[] = [];
  let res = await clioGet(path, { limit: 200, ...params });
  for (;;) {
    const page = (await res.json()) as ListPage<T>;
    results.push(...page.data);
    const next = page.meta?.paging?.next;
    if (!next) return results;
    res = await clioGet(next);
  }
}

const isFieldsError = (e: unknown) =>
  e instanceof ClioHttpError && (e.status === 400 || e.status === 422);

/**
 * Clio rejects unknown `fields`. Try the richest field set first and fall back
 * to simpler ones, so one unsupported field never kills the whole sync.
 */
export async function clioListWithFallback<T>(path: string, params: Params, fieldSets: string[]): Promise<T[]> {
  let lastError: unknown;
  for (const fields of fieldSets) {
    try {
      return await clioList<T>(path, { ...params, fields });
    } catch (e) {
      if (!isFieldsError(e)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}

export async function clioGetOneWithFallback<T>(path: string, fieldSets: string[]): Promise<T> {
  let lastError: unknown;
  for (const fields of fieldSets) {
    try {
      const res = await clioGet(path, { fields });
      return ((await res.json()) as { data: T }).data;
    } catch (e) {
      if (!isFieldsError(e)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
