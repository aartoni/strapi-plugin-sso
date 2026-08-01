import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import dotenv from "dotenv";
import request from "supertest";
import nock from "nock";
import { setupStrapi, stopStrapi } from "../../../playground/tests/helpers";
import { loginAs, mockPayload } from "../tests/oidc-flow.shared";

dotenv.config({ path: "playground/.env" });
process.env.OIDC_DISCOVERY = "false";

describe("sso-roles API permissions", () => {
  const endpoints = {
    tokenEndpoint: process.env.OIDC_TOKEN_ENDPOINT,
    userinfoEndpoint: process.env.OIDC_USER_INFO_ENDPOINT,
  };
  let strapi;
  let editorToken;

  beforeAll(async () => {
    strapi = await setupStrapi();
    const { token } = await loginAs(strapi, endpoints, mockPayload, {
      email: "jane.editor@example.com",
      groups: ["editors"],
    });
    editorToken = token;
  });

  afterAll(async () => {
    await stopStrapi();
    nock.cleanAll();
  });

  it("blocks PUT /sso-roles without update permission", async () => {
    const res = await request(strapi.server.httpServer)
      .put("/oidc/sso-roles")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ expression: "'Editor'" });

    expect(res.status).toBe(403);
  });
});
