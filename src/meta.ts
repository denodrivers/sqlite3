import meta from "../deno.json" with { type: "json" };

export const MODULE_NAME = meta.name;
export const VERSION = meta.version;
