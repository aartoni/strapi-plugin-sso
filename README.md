# strapi-plugin-oidc
[![npm version](https://img.shields.io/npm/v/@aartoni/strapi-plugin-oidc.svg)](https://www.npmjs.com/package/@aartoni/strapi-plugin-oidc)
[![license](https://img.shields.io/npm/l/@aartoni/strapi-plugin-oidc.svg)](./LICENSE)

Single sign-on for Strapi 5! Log in to the administration screen using an OpenID Connect (OIDC) provider.

Optionally overwrites Strapi's default admin login page and endpoints.

## Installation

```sh
yarn add @aartoni/strapi-plugin-oidc
```

or

```sh
npm i @aartoni/strapi-plugin-oidc
```

## Configuration

With OIDC Discovery (recommended: the plugin auto-resolves endpoints from your provider):

```ts
export default ({ env }) => ({
  oidc: {
    enabled: true,
    config: {
      issuer: "https://your-oidc-provider.com",
      clientId: "[Client ID from the provider]",
      clientSecret: "[Client secret from the provider]",
      redirectUri: "https://your-strapi/api/oidc/callback",
      scopes: "openid profile email groups",
    },
  },
});
```

### Full options

Discoverable options are only required when `discovery` is `false`.

| Key | Required | Default | Description |
|---|---|---|---|
| `issuer` | yes | – | Provider issuer URL (used for discovery and id_token validation) |
| `discovery` | no | `true` | Enable OIDC Discovery |
| `clientId` | yes | – | OIDC client ID |
| `clientSecret` | yes | – | OIDC client secret |
| `redirectUri` | yes | – | Callback URL after login |
| `scopes` | no | `"openid profile email groups"` | Space-separated OIDC scopes |
| `authorizationEndpoint` | discoverable | – | Provider authorization endpoint |
| `tokenEndpoint` | discoverable | – | Provider token endpoint |
| `userInfoEndpoint` | discoverable | – | Provider userinfo endpoint |
| `jwksUri` | discoverable | – | Provider JWKS URI |
| `familyNameField` | no | `"family_name"` | Userinfo claim for last name |
| `givenNameField` | no | `"given_name"` | Userinfo claim for first name |
| `rememberMe` | no | `true` | User persisted across restarts (`true`) or cleared when the browser closes (`false`) |

### Reverse proxy

When Strapi runs behind a TLS-terminating reverse proxy (nginx, Traefik, a cloud load balancer), enable Koa proxy trust in `config/server.ts` and ensure the proxy forwards `X-Forwarded-Proto`:

```ts
export default ({ env }) => ({
  // ...
  proxy: { koa: true },
});
```

> [!IMPORTANT]
> Without this, Strapi treats the internal hop as plain HTTP, the admin session cookies set during login are rejected, and sign-in fails silently.

### Optional routing

To overwrite Strapi's default admin login page, you'll have to add an explicit Vite configuration and import the provided plugin.

```ts
import { oidcAuthPagePlugin } from '@aartoni/strapi-plugin-oidc/vite';
import { mergeConfig } from 'vite';

export default (config) =>
  mergeConfig(config, { plugins: [oidcAuthPagePlugin()] });
```

However, this is not enough to guarantee that your Strapi users won't try to login via API. To address that concern, you should load the provided middleware in your `config/middlewares.ts`.

```ts
// Default Strapi middleware stack, plus the native-auth blocker.
export default [
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  "strapi::cors",
  // ...
  "plugin::oidc.block-native-auth",
];
```

Add after the default stack, placing it earlier can block admin panel routes.

## Role mapping

Admin roles can be mapped from OIDC claims using [JMESPath](https://jmespath.org/) expressions. You can edit the expression from this plugin's page in the admin sidebar, but no user can log in until one is set, so bootstrap an initial expression in `src/index.ts` (or equivalent) before first startup. See [`playground/src/index.ts`](playground/src/index.ts) for a working example.

## OIDC provider

See the [Docker compose file](compose.yml) for an example of how to set-up Authelia as an OIDC provider.

Commercial providers might ship OIDC support, including:
- [Google Identity Platform](https://docs.cloud.google.com/identity-platform/docs/web/oidc)
- [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-oidc-idp.html)
- [Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)

## Development

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).
