import { expect } from "@jest/globals";
import request from "supertest";
import nock from "nock";
import { Core } from "@strapi/strapi";

export const ISSUER = "https://auth.example.com";

// Mutable payload. Imported by jose.mock.js (moduleNameMapper) so every
// require("jose") returns this object. Tests update .nonce after sign-in.
export const mockPayload = {
  sub: "test-user",
  nonce: "placeholder",
  iss: ISSUER,
  aud: process.env.OIDC_CLIENT_ID,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

export const DISCO_TOKEN_ENDPOINT = `${ISSUER}/oauth/token`;
export const DISCO_USERINFO_ENDPOINT = `${ISSUER}/oauth/userinfo`;

export function mockDiscovery({ tokenEndpoint, userinfoEndpoint }: Endpoints) {
  nock(ISSUER)
    .persist()
    .get("/.well-known/openid-configuration")
    .reply(200, {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: tokenEndpoint,
      userinfo_endpoint: userinfoEndpoint,
      jwks_uri: `${ISSUER}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
    });
}

type Endpoints = {
  tokenEndpoint: string;
  userinfoEndpoint: string;
};

export type UserinfoOverrides = {
  email?: string;
  groups?: string[];
};

export function mockTokenAndUserinfo(
  { tokenEndpoint, userinfoEndpoint }: Endpoints,
  overrides: UserinfoOverrides = {},
) {
  nock(tokenEndpoint)
    .post(/.*/)
    .reply(200, { access_token: "ACCESS", id_token: "IDTOKEN" });

  nock(userinfoEndpoint)
    .get(/.*/)
    .reply(200, {
      sub: "test-user",
      email: overrides.email ?? "jane.doe@example.com",
      [process.env.OIDC_FAMILY_NAME_FIELD!]: "Doe",
      [process.env.OIDC_GIVEN_NAME_FIELD!]: "Jane",
      groups: overrides.groups ?? ["admins"],
    });
}

export async function assertSignInRedirect(
  agent: ReturnType<typeof request.agent>,
) {
  const authStart = await agent.get("/api/oidc/sign-in").expect(302);
  const url = new URL(authStart.headers.location);

  expect(url.href).toMatch(/^https:\/\/auth\.example\.com\/authorize/);
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("client_id")).toBe(process.env.OIDC_CLIENT_ID);
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("state")).toBeTruthy();
  expect(url.searchParams.get("redirect_uri")).toBe(
    process.env.OIDC_REDIRECT_URI,
  );
  expect(url.searchParams.get("scope")).toBe(process.env.OIDC_SCOPES);

  return url;
}

export async function loginAs(
  strapi: Core.Strapi,
  endpoints: Endpoints,
  mockPayloadRef: typeof mockPayload,
  overrides: UserinfoOverrides = {},
) {
  const agent = request.agent(strapi.server.httpServer);
  const url = await assertSignInRedirect(agent);
  const state = url.searchParams.get("state");
  const nonce = url.searchParams.get("nonce")!;

  expect(nonce).toBeTruthy();
  mockPayloadRef.nonce = nonce;
  mockTokenAndUserinfo(endpoints, overrides);

  const res = await agent.get(
    `/api/oidc/callback?code=FAKE_CODE&state=${state}`,
  );
  expect(res.status).toBe(200);
  expect(res.type).toBe("text/html");
  expect(res.text).toMatch(/<script nonce=/);

  const scriptMatch = res.text.match(
    /<script nonce="([^"]+)">([\s\S]*?)<\/script>/,
  );
  expect(scriptMatch).not.toBeNull();
  const [, nonceAttr, scriptText] = scriptMatch!;
  const nonceHeader =
    res.headers["content-security-policy"].match(/nonce-([^']+)/)![1];
  expect(nonceAttr).toBe(nonceHeader);

  const jwtMatch = scriptText.match(
    /localStorage\.setItem\('jwtToken', '"([^"]+)"'\)/,
  );
  expect(jwtMatch).not.toBeNull();
  const token = jwtMatch![1];
  expect(token.split(".")).toHaveLength(3);

  return { agent, token };
}

export async function assertLoginFlow(
  strapi: Core.Strapi,
  endpoints: Endpoints,
  mockPayloadRef: typeof mockPayload,
) {
  const { agent, token } = await loginAs(strapi, endpoints, mockPayloadRef);

  const me = await agent
    .get("/admin/users/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  expect(me.body.data.email).toBe("jane.doe@example.com");

  return { agent, token };
}
