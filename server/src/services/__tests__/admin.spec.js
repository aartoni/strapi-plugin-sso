import { describe, test, expect, jest } from "@jest/globals";
import accepts from "accepts";
import admin from "../admin";
import { SSO_ERRORS } from "../../utils/errors";

const ctxFor = (acceptLanguage) => {
  const headers = { "accept-language": acceptLanguage };
  const negotiator = accepts({ headers });
  return { acceptsLanguages: (...langs) => negotiator.languages(...langs) };
};

const mockSession = {
  generateRefreshToken: jest.fn().mockResolvedValue({ token: "mock-refresh" }),
  generateAccessToken: jest.fn().mockResolvedValue({ token: "mock-access" }),
};

const mockStrapi = {
  config: {
    admin: { url: "/admin" },
    get: (key) => {
      if (key === "plugin::oidc") return { rememberMe: false };
      return {};
    },
  },
  sessionManager: jest.fn().mockReturnValue(mockSession),
};

describe("admin service", () => {
  const service = admin({ strapi: mockStrapi });

  describe("renderSignInError", () => {
    test.each(Object.entries(SSO_ERRORS))(
      'code "%s" renders the correct message',
      (code, message) => {
        expect(service.renderSignInError(code)).toContain(message);
      },
    );

    test("includes auto-redirect and link back to the login page", () => {
      const html = service.renderSignInError("sso_no_code");
      expect(html).toContain("/admin/auth/login");
      expect(html).toContain('http-equiv="refresh"');
    });
  });

  describe("generateToken", () => {
    const user = { id: 1 };
    const mockCtx = (existingDeviceId = null) => ({
      cookies: {
        get: jest.fn().mockReturnValue(existingDeviceId),
        set: jest.fn(),
      },
    });

    test("sets a new device cookie when none exists", async () => {
      const ctx = mockCtx();
      await service.generateToken(user, ctx);

      const [, deviceId] = ctx.cookies.set.mock.calls[0];
      expect(deviceId).toHaveLength(36);
      expect(ctx.cookies.set).toHaveBeenCalledWith(
        "strapi_admin_device",
        expect.any(String),
        expect.objectContaining({ sameSite: "lax", path: "/admin" }),
      );
    });

    test("reuses the existing device cookie when present", async () => {
      const deviceId = "a1b2c3d4-0000-4000-8000-000000000000";
      const ctx = mockCtx(deviceId);
      await service.generateToken(user, ctx);

      expect(ctx.cookies.set).not.toHaveBeenCalledWith(
        "strapi_admin_device",
        expect.anything(),
        expect.anything(),
      );
      expect(mockSession.generateRefreshToken).toHaveBeenCalledWith(
        String(user.id),
        deviceId,
        expect.any(Object),
      );
    });
  });

  describe("localeFindByHeader", () => {
    test.each([
      ["fr", "fr"],
      ["en", "en"],
      ["fr,en;q=0.8", "fr"],
      ["en-US,en;q=0.9", "en"],
      ["ja", "en"],
      [undefined, "en"],
    ])("Accept-Language %p → %p", (header, expected) => {
      expect(service.localeFindByHeader(ctxFor(header))).toBe(expected);
    });
  });
});
