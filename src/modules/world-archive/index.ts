import { registry } from "@/core";
import type { ModuleManifest } from "@/core/registry";
import { SaveEvents } from "@/domain/events";
import type { SaveDeletedPayload } from "@/domain/events/save";

import { applyArchiveUpdatesAndSync } from "./apply-updates";
import { computeArchiveData } from "./archive-injector";
import { autoRegisterNpcs } from "./auto-register";
import {
  getWorldArchiveRepository,
  resetWorldArchiveRepository,
} from "./repository";
import { useWorldArchiveStore } from "./store";

const manifest: ModuleManifest = {
  id: "lyra.world-archive",
  version: "0.1.0",
  eventHandlers: {
    [SaveEvents.SAVE_LOADED]: () => {
      resetWorldArchiveRepository();

      try {
        const repo = getWorldArchiveRepository();
        const entities = repo.getAllEntities();
        useWorldArchiveStore.getState()._setEntities(entities);
      } catch {
        // 新存档或无数据时静默处理
      }
    },
    [SaveEvents.SAVE_DELETED]: (event) => {
      const payload = event.payload as SaveDeletedPayload;
      if (payload.isCurrentSave) {
        resetWorldArchiveRepository();
        useWorldArchiveStore.getState()._clear();
      }
    },
  },
};

export async function registerWorldArchiveModule(): Promise<void> {
  await registry.register(manifest);
}

export async function unregisterWorldArchiveModule(): Promise<void> {
  await registry.unregister("lyra.world-archive");
}

export type {
  ArchiveSnapshot,
  ArchiveUpdate,
  EntityArchetype,
  EntityPresence,
  EntityRelationship,
  EvolutionEntry,
  NarrativeEntity,
} from "./types";
export {
  applyArchiveUpdatesAndSync,
  autoRegisterNpcs,
  computeArchiveData,
  useWorldArchiveStore,
};
