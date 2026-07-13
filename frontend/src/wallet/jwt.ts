// Self-signed session JWTs for the gateway's demo IDP ("unsafe-auth").
// The gateway's self_signed IDP validates issuer/sub/scope claims only; the
// HMAC secret ("unsafe") matches the vendored gateway config. Demo-grade auth
// by design — see the custody note in wallet/README.md.

const encoder = new TextEncoder();

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const b64urlJson = (obj: unknown): string => b64url(encoder.encode(JSON.stringify(obj)));

const cache = new Map<string, { token: string; expiresAt: number }>();

export async function selfSignedJwt(sub: string): Promise<string> {
  const cached = cache.get(sub);
  if (cached && Date.now() < cached.expiresAt - 10 * 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({
    iss: "unsafe-auth",
    sub,
    scope: "openid daml_ledger_api offline_access",
    aud: "https://canton.network.global",
    iat: now,
    exp: now + 8 * 3600,
  });
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("unsafe"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`)),
  );
  const token = `${header}.${payload}.${b64url(sig)}`;
  cache.set(sub, { token, expiresAt: (now + 8 * 3600) * 1000 });
  return token;
}
