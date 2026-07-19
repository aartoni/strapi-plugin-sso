export enum SsoError {
  NoCode = "sso_no_code",
  InvalidState = "sso_invalid_state",
  AccessDenied = "sso_access_denied",
  Failed = "sso_failed",
}

export const SSO_ERRORS: Record<SsoError, string> = {
  [SsoError.NoCode]: "No authorization code was returned by the provider.",
  [SsoError.InvalidState]:
    "The login request could not be verified. Please try again.",
  [SsoError.AccessDenied]:
    "Your account has not been granted access. Please contact your administrator.",
  [SsoError.Failed]:
    "Authentication failed. Please try again or contact your administrator.",
};
