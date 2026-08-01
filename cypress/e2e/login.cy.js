/// <reference types="cypress" />

import pluginPkg from "../../package.json";

const CMS = "https://cms.strapi.local";
const IDP = "https://auth.strapi.local";
const PLUGIN_ID = pluginPkg.strapi.name;

describe("SSO plugin", () => {
  describe("OIDC sign-in", () => {
    beforeEach(() => {
      cy.login();
      cy.visit(`${CMS}/admin`);
    });

    it("provisions john.doe@example.org and lands in the admin", () => {
      cy.url().should("include", "/admin");
      cy.window()
        .its("localStorage")
        .invoke("getItem", "isLoggedIn")
        .should("eq", "true");

      // Confirm the session belongs to the OIDC-provisioned user
      cy.jwtToken().then((token) =>
        cy
          .request({
            url: "/admin/users/me",
            headers: { Authorization: `Bearer ${token}` },
          })
          .its("body.data.email")
          .should("eq", "john.doe@example.org"),
      );
    });
  });

  describe("role mapping by group", () => {
    beforeEach(() => {
      cy.loginAs("jane", "password");
      cy.visit(`${CMS}/admin`);
    });

    it("assigns the Editor role to jane.editor@example.org via the editors group", () => {
      cy.jwtToken().then((token) =>
        cy
          .request({
            url: "/admin/users/me",
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => {
            expect(res.body.data.email).to.eq("jane.editor@example.org");
            expect(res.body.data.roles.map((r) => r.code)).to.include(
              "strapi-editor",
            );
          }),
      );
    });
  });

  describe("plugin access for a non-admin (Editor)", () => {
    const ignorePolicyFailed = (err) => {
      if (err.message.includes("Policy Failed")) return false;
      return true;
    };

    beforeEach(() => {
      Cypress.on("uncaught:exception", ignorePolicyFailed);
      cy.loginAs("jane", "password");
      cy.visit(`${CMS}/admin`);
    });

    afterEach(() => {
      Cypress.off("uncaught:exception", ignorePolicyFailed);
    });

    it("hides the SSO link from an Editor's sidebar", () => {
      cy.findByRole("navigation").within(() => {
        cy.get('a[href*="/content-manager"]').should("be.visible");
        cy.get(`a[href*="/plugins/${PLUGIN_ID}"]`).should("not.exist");
      });
    });

    it("blocks direct navigation to the plugin page", () => {
      cy.visit(`${CMS}/admin/plugins/${PLUGIN_ID}`, {
        failOnStatusCode: false,
      });
      cy.findByRole("heading", { name: /single sign-on/i }).should("not.exist");
      cy.contains(/you don't have the permissions/i).should("be.visible");
    });
  });

  describe("login page redirect", () => {
    it("sends authenticated users to the admin dashboard", () => {
      cy.login();
      cy.visit(`${CMS}/admin/auth/login`);
      cy.url().should("include", "/admin");
      cy.url().should("not.include", "/auth/");
    });

    it("sends unauthenticated visitors to the OIDC provider", () => {
      cy.origin(IDP, { args: { cms: CMS } }, ({ cms }) => {
        cy.visit(`${cms}/admin/auth/login`);
        cy.get("#username-textfield").should("exist");
        cy.get("#password-textfield").should("exist");
      });
    });
  });

  describe("native auth endpoints", () => {
    [
      "/admin/login",
      "/admin/register",
      "/admin/register-admin",
      "/admin/forgot-password",
      "/admin/reset-password",
    ].forEach((path) => {
      it(`blocks POST ${path}`, () => {
        cy.request({
          method: "POST",
          url: `${CMS}${path}`,
          failOnStatusCode: false,
        })
          .its("status")
          .should("eq", 403);
      });
    });
  });

  describe("error rendering", () => {
    it("shows the error page when callback is missing the auth code", () => {
      cy.visit(`${CMS}/api/${PLUGIN_ID}/callback`, {
        failOnStatusCode: false,
      });
      cy.contains("Authentication failed").should("be.visible");
      cy.get('meta[http-equiv="refresh"]').should("exist");
    });
  });

  describe("settings page", () => {
    beforeEach(() => {
      cy.login();

      cy.intercept("GET", `/${PLUGIN_ID}/sso-roles`, {
        fixture: "sso-roles.json",
      }).as("getSSORoles");

      cy.visit(`${CMS}/admin/plugins/${PLUGIN_ID}`);
      cy.wait("@getSSORoles");
    });

    it("renders the role attribute path field", () => {
      cy.findByRole("heading", { name: /single sign-on/i }).should("exist");
      cy.contains(
        /assign strapi roles to users based on their oidc claims/i,
      ).should("be.visible");
      cy.findByRole("textbox").should("exist");
      cy.findByRole("button", { name: /save/i }).should("be.visible");
    });
  });
});
