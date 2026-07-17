import { Data } from "@strapi/strapi";

export type AdminRole = Data.ContentType<"admin::role">;
export type AdminUser = Data.ContentType<"admin::user">;

export type AdminSessionsConfig = {
  accessTokenLifespan?: number;
  maxRefreshTokenLifespan?: number;
  idleRefreshTokenLifespan?: number;
  maxSessionLifespan?: number;
  idleSessionLifespan?: number;
};
