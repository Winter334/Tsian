/**
 * 默认作者态世界
 */

import type { World } from "../types";
import { DEFAULT_WORLD_CONFIG } from "../types";

export const defaultWorld: World = {
  id: DEFAULT_WORLD_CONFIG.worldId ?? "lyra-default-world",
  meta: {
    name: DEFAULT_WORLD_CONFIG.worldName ?? "默认世界",
    description: "Lyra 内置默认世界",
    version: "1.0.0",
    createdAt: 0,
    updatedAt: 0,
    source: "lyra",
  },
  rules: DEFAULT_WORLD_CONFIG,
  narrative: {},
};

export const defaultWorldConfig = defaultWorld.rules;
