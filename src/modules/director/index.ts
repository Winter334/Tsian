import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { SaveEvents } from "@/domain/events";
import type { SaveDeletedPayload } from "@/domain/events/save";

import { buildDirectorContext } from "./context-builder";
import { directorAgent } from "./director-agent";
import { getDirectorRepository, resetDirectorRepository } from "./repository";
import { useDirectorStore } from "./store";

const manifest: ModuleManifest = {
  id: "lyra.director",
  version: "0.1.0",
  eventHandlers: {
    [SaveEvents.SAVE_LOADED]: () => {
      resetDirectorRepository();

      try {
        const repo = getDirectorRepository();
        const outline = repo.getOutline();
        const foreshadows = repo.getAllForeshadows();
        const directorLog = repo.getDirectorLog();

        useDirectorStore.getState()._setAll({
          outline,
          foreshadows,
          directorLog,
        });
      } catch {
        // 新存档或无数据时静默处理
      }
    },
    [SaveEvents.SAVE_DELETED]: (event) => {
      const payload = event.payload as SaveDeletedPayload;
      if (payload.isCurrentSave) {
        resetDirectorRepository();
        useDirectorStore.getState()._clear();
      }
    },
  },
};

export async function registerDirectorModule(): Promise<void> {
  await registry.register(manifest);
}

export async function unregisterDirectorModule(): Promise<void> {
  await registry.unregister("lyra.director");
}

export { DirectorOutputParseError, parseDirectorOutput } from "./output-parser";
export type {
  DirectorLogEntry,
  DirectorOutput,
  Foreshadow,
  Milestone,
  PlotOutline,
  StoryArc,
} from "./types";
export { buildDirectorContext, directorAgent, useDirectorStore };
