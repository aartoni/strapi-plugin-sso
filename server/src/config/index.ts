import {
  Config,
  ALWAYS_REQUIRED_FIELDS,
  DISCOVERABLE_FIELDS,
} from "../utils/config";

const DEFAULTS = {
  discovery: true,
  rememberMe: true,
  scopes: "openid profile email groups",
  familyNameField: "family_name",
  givenNameField: "given_name",
} as Config;

const TYPE_FIELDS_MAP = {
  boolean: ["discovery", "rememberMe"] as const,
  string: ["scopes", "familyNameField", "givenNameField"] as const,
};

function validator(config: Config) {
  for (const [type, props] of Object.entries(TYPE_FIELDS_MAP)) {
    for (const prop of props) {
      if (typeof config[prop] !== type) {
        throw new Error(
          `'${prop}' must be a ${type}, received ${typeof config[prop]}.`,
        );
      }
    }
  }
  const required = config.discovery
    ? ALWAYS_REQUIRED_FIELDS
    : [...ALWAYS_REQUIRED_FIELDS, ...DISCOVERABLE_FIELDS];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`These are required: ${missing.join(", ")}.`);
  }

  const scopes = config.scopes.split(/\s+/);
  if (!scopes.includes("openid")) {
    throw new Error("The 'openid' scope is required.");
  }
}

export default { default: DEFAULTS, validator };
