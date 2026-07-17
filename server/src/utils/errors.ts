export const SSO_ERRORS = {
  sso_no_code: "No authorization code was returned by the provider.",
  sso_invalid_state:
    "The login request could not be verified. Please try again.",
  sso_access_denied:
    "Your account has not been granted access. Please contact your administrator.",
  sso_failed:
    "Authentication failed. Please try again or contact your administrator.",
} as const;

export type SsoErrorCode = keyof typeof SSO_ERRORS;
