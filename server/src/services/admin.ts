import { Core } from "@strapi/strapi";
import { SetOption } from "cookies";
import { randomBytes, randomUUID } from "node:crypto";
import { Context } from "koa";
import { Config } from "../utils/config";
import { SsoErrorCode } from "../utils/errors";
import { AdminSessionsConfig, AdminUser } from "../types/strapi";

export enum SsoError {
  sso_no_code = "No authorization code was returned by the provider.",
  sso_invalid_state = "The login request could not be verified. Please try again.",
  sso_access_denied = "Your account has not been granted access. Please contact your administrator.",
  sso_failed = "Authentication failed. Please try again or contact your administrator.",
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async createUser(
    email: string,
    lastname: string,
    firstname: string,
    locale: string,
    roles = [],
  ) {
    const userService = strapi.service("admin::user");
    const normalizedEmail = email.toLowerCase();
    const existing = await userService.findOneByEmail(normalizedEmail);
    if (existing) {
      return existing;
    }

    const resolvedFirstName = firstname || email.split("@")[0];
    const createdUser = await userService.create({
      firstname: resolvedFirstName,
      lastname: lastname ?? "",
      email: normalizedEmail,
      roles,
      preferedLanguage: locale,
    });

    return await userService.register({
      registrationToken: createdUser.registrationToken,
      userInfo: {
        firstname: resolvedFirstName,
        lastname: lastname ?? "",
        password: randomBytes(32).toString("hex"),
      },
    });
  },
  localeFindByHeader(ctx: Context) {
    return ctx.acceptsLanguages("en", "fr", "it") || "en";
  },
  async triggerWebHook(user: AdminUser) {
    const eventHub = strapi.eventHub;
    const schema = strapi.getModel("admin::user");
    const sanitizedEntity = await strapi.contentAPI.sanitize.output(
      user,
      schema,
    );

    eventHub.emit("entry.create", {
      model: schema.modelName,
      entry: sanitizedEntity,
    });
  },
  triggerSignInSuccess(user: AdminUser) {
    const { password, ...safeUser } = user;
    const eventHub = strapi.eventHub;
    eventHub.emit("admin.auth.success", {
      user: safeUser,
      provider: "oidc",
    });
  },
  // Sign In Success
  renderSignInSuccess(jwtToken: string, nonce: string) {
    // get rememberMe from config
    const config: Config = strapi.config.get("plugin::oidc");
    const rememberMe = !!config.rememberMe;
    const isRememberMe = rememberMe;

    return `
<!doctype html>
<html>
<head>
<script nonce="${nonce}">
 window.addEventListener('load', function() {
  if(${isRememberMe}){
    localStorage.setItem('jwtToken', '"${jwtToken}"');
  }else{
    document.cookie = 'jwtToken=${encodeURIComponent(jwtToken)}; Path=/';
  }
  localStorage.setItem('isLoggedIn', 'true');
  location.href = '${strapi.config.admin.url}'
 })
</script>
</head>
<body>
<noscript>JavaScript must be enabled for authentication</noscript>
</body>
</html>`;
  },
  renderSignInError(code: SsoErrorCode) {
    const message = SsoError[code] ?? SsoError.sso_failed;
    const loginUrl = `${strapi.config.admin.url}/auth/login`;
    return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="5;url=${loginUrl}">
<title>Authentication failed</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center;
         min-height: 100vh; margin: 0; background: #f6f6f9; color: #32324d; }
  .card { background: #fff; padding: 2rem 2.5rem; border-radius: 4px;
          box-shadow: 0 1px 4px rgba(33,33,52,.1); max-width: 24rem; text-align: center; }
  h3 { margin: 0 0 .5rem; }
  p { color: #666687; margin: 0 0 1.25rem; }
  a { color: #4945ff; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <h3>Authentication failed</h3>
  <p>${message}</p>
  <a href="${loginUrl}">Return to login</a>
  <p style="font-size:.8rem;margin-top:1rem">Redirecting in 5 seconds…</p>
</div>
</body>
</html>`;
  },
  async generateToken(user: AdminUser, ctx: Context) {
    const sessionManager = strapi.sessionManager;
    const userId = String(user.id);

    let deviceId = ctx.cookies.get("strapi_admin_device");
    if (!deviceId) {
      deviceId = randomUUID();
      ctx.cookies.set("strapi_admin_device", deviceId, {
        sameSite: "lax",
        path: "/admin",
        secure: !["development", "test"].includes(process.env.NODE_ENV ?? ""),
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }

    const config: Config = strapi.config.get("plugin::oidc");
    const rememberMe = !!config.rememberMe;

    const { token: refreshToken } = await sessionManager(
      "admin",
    ).generateRefreshToken(userId, deviceId, {
      type: rememberMe ? "refresh" : "session",
    });

    const sessions = strapi.config.get<AdminSessionsConfig>(
      "admin.auth.sessions",
      {},
    );
    const maxRefresh = sessions.maxRefreshTokenLifespan ?? 0;
    const cookieOptions: SetOption = {
      sameSite: "lax",
      ...strapi.config.get("admin.auth.cookie", {}),
      ...(rememberMe && Number.isFinite(maxRefresh)
        ? { maxAge: maxRefresh * 1000 }
        : {}),
    };
    ctx.cookies.set("strapi_admin_refresh", refreshToken, cookieOptions);

    const accessResult =
      await sessionManager("admin").generateAccessToken(refreshToken);
    if ("error" in accessResult) {
      throw new Error(accessResult.error);
    }
    const { token: accessToken } = accessResult;
    return accessToken;
  },
});
