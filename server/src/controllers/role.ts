import { Context } from "koa";
import { Core } from "@strapi/strapi";
import { RoleConfig, RoleService } from "../services/role";
import PLUGIN_ID from "../pluginId";

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: Context) {
    const roleService: RoleService = strapi.plugin(PLUGIN_ID).service("role");
    ctx.send((await roleService.getConfig()) ?? {});
  },
  async update(ctx: Context) {
    try {
      const roleService: RoleService = strapi.plugin(PLUGIN_ID).service("role");
      await roleService.setConfig(ctx.request.body as RoleConfig);
      ctx.send({}, 204);
    } catch (e) {
      if (!(e instanceof Error)) throw e;
      strapi.log.error(e);
      ctx.send({ error: e.message }, 400);
    }
  },
});
