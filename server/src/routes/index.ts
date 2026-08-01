export default {
  admin: {
    type: "admin",
    routes: [
      {
        method: "GET",
        path: "/sso-roles",
        handler: "role.find",
        config: {
          policies: [
            "admin::isAuthenticatedAdmin",
            {
              name: "admin::hasPermissions",
              config: { actions: ["plugin::oidc.read"] },
            },
          ],
        },
      },
      {
        method: "PUT",
        path: "/sso-roles",
        handler: "role.update",
        config: {
          policies: [
            "admin::isAuthenticatedAdmin",
            {
              name: "admin::hasPermissions",
              config: { actions: ["plugin::oidc.update"] },
            },
          ],
        },
      },
    ],
  },
  "content-api": {
    type: "content-api",
    routes: [
      {
        method: "GET",
        path: "/sign-in",
        handler: "oidc.signIn",
        config: { auth: false },
      },
      {
        method: "GET",
        path: "/callback",
        handler: "oidc.callback",
        config: { auth: false },
      },
    ],
  },
};
