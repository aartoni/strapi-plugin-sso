export type Config = {
  discovery: boolean;
  rememberMe: boolean;

  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  familyNameField: string;
  givenNameField: string;

  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUri: string;
};

export type RawConfig = { [K in keyof Config]?: unknown };

export const ALWAYS_REQUIRED_FIELDS: (keyof Config)[] = [
  "issuer",
  "clientId",
  "clientSecret",
  "redirectUri",
  "scopes",
];

// The four fields the discovery document supplies (jwks_uri + three endpoints).
// Required only when discovery is off; populated by bootstrap when on.
export const DISCOVERABLE_FIELDS = [
  "authorizationEndpoint",
  "tokenEndpoint",
  "userInfoEndpoint",
  "jwksUri",
] as const satisfies readonly (keyof Config)[];
