import pluginPkg from "../../package.json";
import PLUGIN_ID from "./pluginId";
import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";
import { prefixPluginTranslations } from "./utils/translations";
import { StrapiApp } from "@strapi/strapi/admin";

const name = pluginPkg.strapi.displayName;

export default {
  bootstrap() {},
  register(app: StrapiApp) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: "Single Sign-On",
      },
      Component: () => import("./pages/App"),
      permissions: [{ action: `plugin::${PLUGIN_ID}.read`, subject: null }],
    });
    app.registerPlugin({ id: PLUGIN_ID, initializer: Initializer, name });
  },
  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(
            `./translations/${locale}.json`
          );
          return { data: prefixPluginTranslations(data, PLUGIN_ID), locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};
