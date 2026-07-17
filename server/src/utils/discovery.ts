import { Config, DISCOVERABLE_FIELDS } from "./config";
import { getJson } from "./http";

export type DiscoveredEndpoints = Pick<
  Config,
  (typeof DISCOVERABLE_FIELDS)[number]
>;

type DiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
};

const DISCOVERY_ENDPOINT_CLAIMS: (keyof DiscoveryDocument)[] = [
  "authorization_endpoint",
  "token_endpoint",
  "userinfo_endpoint",
  "jwks_uri",
];

export async function discoverEndpoints(issuer: string) {
  const base = issuer.replace(/\/+$/, "");
  const doc = await getJson<DiscoveryDocument>(
    `${base}/.well-known/openid-configuration`,
  );

  // OIDC Discovery 1.0 §4.3: the document issuer MUST equal the configured
  // issuer, compared verbatim. Same string the id_token iss check uses.
  if (doc.issuer !== issuer) {
    throw new Error(
      `OIDC discovery issuer mismatch: document reports "${doc.issuer}", expected "${issuer}".`,
    );
  }

  const missing = DISCOVERY_ENDPOINT_CLAIMS.filter((key) => !doc[key]);
  if (missing.length > 0) {
    throw new Error(
      `OIDC discovery document is missing required endpoints: ${missing.join(", ")}.`,
    );
  }

  return {
    authorizationEndpoint: doc.authorization_endpoint,
    tokenEndpoint: doc.token_endpoint,
    userInfoEndpoint: doc.userinfo_endpoint,
    jwksUri: doc.jwks_uri,
  };
}
