import { useAuth } from "@strapi/strapi/admin";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";

/**
 * Replaces Strapi's AuthPage for all /auth/:authType routes.
 *
 * Authenticated users are sent to / (same behavior as the native AuthPage).
 * Everyone else is redirected to the OIDC sign-in endpoint.
 */
const OidcLoginPage = () => {
  const token = useAuth("OidcLoginPage", (auth) => auth.token);

  useEffect(() => {
    if (!token) window.location.replace("/api/oidc/sign-in");
  }, [token]);

  if (token) return <Navigate to="/" />;
};

// Named export must match what @strapi/admin's router.mjs destructures:
//   element: jsx(AuthPage.AuthPage, {})
export { OidcLoginPage as AuthPage };
