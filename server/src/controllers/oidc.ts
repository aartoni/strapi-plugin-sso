import { Context } from "koa";
import { getJson, postForm } from "../utils/http";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Config } from "../utils/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import PLUGIN_ID from "../pluginId";

let jwkSet: ReturnType<typeof createRemoteJWKSet> | undefined;

const getJwkSet = (jwksUri: string) =>
  (jwkSet ??= createRemoteJWKSet(new URL(jwksUri)));

const oidcSignIn = async (ctx: Context) => {
  const { clientId, redirectUri, scopes, authorizationEndpoint } =
    strapi.config.get<Config>("plugin::oidc");

  // Generate code verifier and code challenge as per RFC 7636
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Store the code verifier in the session
  ctx.session.codeVerifier = codeVerifier;

  const state = randomBytes(32).toString("base64url");
  ctx.session.oidcState = state;

  // nonce: binds the ID token to this session to prevent replay.
  // OPTIONAL for the code flow, but if sent it MUST be checked against
  // the id_token's nonce claim (verified in the callback).
  // OIDC Core 1.0 §3.1.2.1 https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
  const oidcNonce = randomBytes(32).toString("base64url");
  ctx.session.oidcNonce = oidcNonce;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce: oidcNonce,
  });

  ctx.redirect(`${authorizationEndpoint}?${params}`);
};

const oidcSignInCallback = async (ctx: Context) => {
  const config = strapi.config.get<Config>("plugin::oidc");
  const userService = strapi.service("admin::user");
  const adminService = strapi.plugin(PLUGIN_ID).service("admin");
  const roleService = strapi.plugin(PLUGIN_ID).service("role");

  // Read and clear one-time session values up front so they can't be reused
  const oidcState = ctx.session.oidcState;
  const codeVerifier = ctx.session.codeVerifier;
  const oidcNonce = ctx.session.oidcNonce;
  delete ctx.session.oidcState;
  delete ctx.session.codeVerifier;
  delete ctx.session.oidcNonce;

  if (!ctx.query.code) {
    ctx.body = adminService.renderSignInError("sso_no_code");
    return;
  }
  if (!ctx.query.state || ctx.query.state !== oidcState) {
    ctx.body = adminService.renderSignInError("sso_invalid_state");
    return;
  }

  const params = new URLSearchParams({
    code: ctx.query.code as string,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  try {
    const response = await postForm<OidcTokenResponse>(
      config.tokenEndpoint,
      params,
    );

    const { payload } = await jwtVerify(
      response.id_token,
      getJwkSet(config.jwksUri),
      { issuer: config.issuer, audience: config.clientId },
    );

    if (!oidcNonce || payload.nonce !== oidcNonce) {
      ctx.body = adminService.renderSignInError("sso_invalid_state");
      return;
    }

    const userResponse = await getJson<OidcUserInfo>(config.userInfoEndpoint, {
      Authorization: `Bearer ${response.access_token}`,
    });

    // OIDC Core §5.3.2: the userinfo `sub` MUST exactly match the verified
    // id_token `sub`, otherwise the response isn't bound to this login.
    if (!payload.sub || userResponse.sub !== payload.sub) {
      ctx.body = adminService.renderSignInError("sso_failed");
      return;
    }

    const email = userResponse.email.toLowerCase();
    let user = await userService.findOneByEmail(email);

    if (!user) {
      const roles = await roleService.resolveRole(userResponse);
      if (!roles?.length) {
        ctx.body = adminService.renderSignInError("sso_access_denied");
        return;
      }

      user = await adminService.createUser(
        email,
        userResponse[config.givenNameField],
        userResponse[config.familyNameField],
        adminService.localeFindByHeader(ctx),
        roles,
      );
      await adminService.triggerWebHook(user);
    }

    const jwtToken = await adminService.generateToken(user, ctx);
    adminService.triggerSignInSuccess(user);

    // Client-side authentication persistence and redirection
    const nonce = randomUUID();
    const html = adminService.renderSignInSuccess(jwtToken, nonce);
    ctx.set("Content-Security-Policy", `script-src 'nonce-${nonce}'`);
    ctx.body = html;
  } catch (e) {
    strapi.log.error(e);
    ctx.body = adminService.renderSignInError("sso_failed");
    return;
  }
};

export default {
  oidcSignIn,
  oidcSignInCallback,
};
