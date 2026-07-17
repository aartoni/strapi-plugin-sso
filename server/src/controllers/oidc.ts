import { Context } from "koa";
import { getJson, postForm } from "../utils/http";
import { randomUUID, randomBytes } from "node:crypto";
import pkceChallenge from "pkce-challenge";
import { Config } from "../utils/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

let remoteJwkSet: ReturnType<typeof createRemoteJWKSet> | undefined;
let cachedJwksUri: string | undefined;

const getJwkSet = (jwksUri: string) => {
  if (!remoteJwkSet || cachedJwksUri !== jwksUri) {
    remoteJwkSet = createRemoteJWKSet(new URL(jwksUri));
    cachedJwksUri = jwksUri;
  }
  return remoteJwkSet;
};

const oidcSignIn = async (ctx: Context) => {
  let state = ctx.query.state as string;
  const { clientId, redirectUri, scopes, authorizationEndpoint } =
    strapi.config.get<Config>("plugin::oidc");

  // Generate code verifier and code challenge
  const { code_verifier: codeVerifier, code_challenge: codeChallenge } =
    await pkceChallenge();

  // Store the code verifier in the session
  ctx.session.codeVerifier = codeVerifier;

  if (!state) {
    state = randomBytes(32).toString("base64url");
  }
  ctx.session.oidcState = state;

  // nonce: binds the ID token to this session to prevent replay.
  // OPTIONAL for the code flow, but if sent it MUST be checked against
  // the id_token's nonce claim (verified in the callback).
  // OIDC Core 1.0 §3.1.2.1 https://openid.net/specs/openid-connect-core-1_0.html#AuthRequest
  const oidcNonce = randomBytes(32).toString("base64url");
  ctx.session.oidcNonce = oidcNonce;

  const params = new URLSearchParams();
  params.append("response_type", "code");
  params.append("client_id", clientId);
  params.append("redirect_uri", redirectUri);
  params.append("scope", scopes);
  params.append("code_challenge", codeChallenge);
  params.append("code_challenge_method", "S256");
  params.append("state", state);
  params.append("nonce", oidcNonce);

  ctx.redirect(`${authorizationEndpoint}?${params}`);
};

const oidcSignInCallback = async (ctx: Context) => {
  const config = strapi.config.get<Config>("plugin::oidc");
  const userService = strapi.service("admin::user");
  const adminService = strapi.plugin("oidc").service("admin");
  const roleService = strapi.plugin("oidc").service("role");

  // Read and clear one-time session values up front so they can't be reused
  const oidcState = ctx.session.oidcState;
  const codeVerifier = ctx.session.codeVerifier;
  const oidcNonce = ctx.session.oidcNonce;
  delete ctx.session.oidcState;
  delete ctx.session.codeVerifier;
  delete ctx.session.oidcNonce;

  if (!ctx.query.code) {
    ctx.body = adminService.renderSignUpError("sso_no_code");
    return;
  }
  if (!ctx.query.state || ctx.query.state !== oidcState) {
    ctx.body = adminService.renderSignUpError("sso_invalid_state");
    return;
  }

  const params = new URLSearchParams();
  params.append("code", ctx.query.code as string);
  params.append("client_id", config.clientId);
  params.append("client_secret", config.clientSecret);
  params.append("redirect_uri", config.redirectUri);
  params.append("grant_type", "authorization_code");

  // Include the code verifier from the session
  params.append("code_verifier", codeVerifier);

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
      ctx.body = adminService.renderSignUpError("sso_invalid_state");
      return;
    }

    const userResponse = await getJson<OidcUserInfo>(config.userInfoEndpoint, {
      Authorization: `Bearer ${response.access_token}`,
    });

    // OIDC Core §5.3.2: the userinfo `sub` MUST exactly match the verified
    // id_token `sub`, otherwise the response isn't bound to this login.
    if (!payload.sub || userResponse.sub !== payload.sub) {
      ctx.body = adminService.renderSignUpError("sso_failed");
      return;
    }

    const email = userResponse.email;

    const dbUser = await userService.findOneByEmail(email);
    let activateUser;
    let jwtToken;

    if (dbUser) {
      // Already registered
      activateUser = dbUser;
      jwtToken = await adminService.generateToken(dbUser, ctx);
    } else {
      // Register a new account
      const roles = await roleService.resolveRole(userResponse);
      if (!roles) {
        ctx.body = adminService.renderSignUpError("sso_access_denied");
        return;
      }

      const defaultLocale = adminService.localeFindByHeader(ctx);
      activateUser = await adminService.createUser(
        email,
        userResponse[config.familyNameField],
        userResponse[config.givenNameField],
        defaultLocale,
        roles,
      );
      jwtToken = await adminService.generateToken(activateUser, ctx);

      // Trigger webhook
      await adminService.triggerWebHook(activateUser);
    }

    // Login Event Call
    adminService.triggerSignInSuccess(activateUser);

    // Client-side authentication persistence and redirection
    const nonce = randomUUID();
    const html = adminService.renderSignUpSuccess(jwtToken, nonce);
    ctx.set("Content-Security-Policy", `script-src 'nonce-${nonce}'`);
    ctx.body = html;
  } catch (e) {
    strapi.log.error(e);
    ctx.body = adminService.renderSignUpError("sso_failed");
    return;
  }
};

export default {
  oidcSignIn,
  oidcSignInCallback,
};
