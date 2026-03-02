import { registry } from "@/core";
import type {
  Command,
  CommandContext,
  CommandHandler,
  CommandResult,
} from "@/core/command-bus";
import type { ModuleManifest } from "@/core/registry";
import {
  WorldArchiveCommands,
  type AddWorldArchiveRelationshipPayload,
  type CreateWorldArchiveEntityPayload,
  type RemoveWorldArchiveRelationshipPayload,
  type SyncPipelineArchiveChangesPayload,
  type UpdateWorldArchiveEntityEssencePayload,
  type UpdateWorldArchiveEntityNamePayload,
  type UpdateWorldArchiveEntityPresencePayload,
  type UpdateWorldArchiveEntityStatePayload,
  type UpdateWorldArchiveRelationshipPayload,
  type UpdateWorldArchiveTagsPayload,
} from "@/domain";
import { SaveEvents } from "@/domain/events";
import type { SaveDeletedPayload } from "@/domain/events/save";
import type { CreatedNpcData } from "@/domain/types";

import { snapshotRegistry } from "@/modules/checkpoint/snapshot-api";
import { applyArchiveUpdatesAndSync } from "./apply-updates";
import { computeArchiveData } from "./archive-injector";
import { autoRegisterNpcs } from "./auto-register";
import {
  getWorldArchiveRepository,
  resetWorldArchiveRepository,
} from "./repository";
import { saveArchiveEntity, saveArchiveEntityById } from "./save-entity";
import { worldArchiveSnapshotFields } from "./snapshot";
import { useWorldArchiveStore } from "./store";
import { WorldArchiveSyncBridge } from "./sync/WorldArchiveSyncBridge";
import type { ArchiveUpdate } from "./types";

function persistArchiveEntityById(entityId: string): void {
  const entity = useWorldArchiveStore.getState().entities[entityId];
  if (!entity) {
    return;
  }

  try {
    const repository = getWorldArchiveRepository();
    repository.saveEntity(entity);
  } catch {
    console.warn(`[WorldArchive] 持久化实体失败（entityId=${entityId}）`);
  }
}

function ensureEntityExists(entityId: string): CommandResult<void> | null {
  const exists = Boolean(useWorldArchiveStore.getState().entities[entityId]);
  if (exists) {
    return null;
  }

  return {
    success: false,
    error: `[WorldArchive] 未找到实体（entityId=${entityId}）`,
  };
}

let syncBridge: WorldArchiveSyncBridge | null = null;

function rebuildSyncBridgeForCurrentSave(): void {
  if (syncBridge) {
    syncBridge.destroy({ clearStore: false });
    syncBridge = null;
  }

  resetWorldArchiveRepository();

  try {
    const repository = getWorldArchiveRepository();
    syncBridge = new WorldArchiveSyncBridge(repository);
    syncBridge.hydrate();
    syncBridge.startObserving();
  } catch {
    useWorldArchiveStore.getState()._clear();
  }
}

function destroySyncBridge(clearStore: boolean): void {
  if (syncBridge) {
    syncBridge.destroy({ clearStore });
    syncBridge = null;
  } else if (clearStore) {
    useWorldArchiveStore.getState()._clear();
  }

  resetWorldArchiveRepository();
}

const createEntityHandler: CommandHandler<
  CreateWorldArchiveEntityPayload,
  { entityId: string }
> = async (
  command: Command<CreateWorldArchiveEntityPayload>,
  _context: CommandContext,
): Promise<CommandResult<{ entityId: string }>> => {
  const { archetype, name, essence, currentState, presence, tags } =
    command.payload;

  const created = useWorldArchiveStore.getState().createEntity({
    archetype,
    name,
    essence,
    currentState,
    presence,
    introducedAtTurn: 0,
    lastActiveTurn: 0,
    relationships: [],
    tags,
    gameEntityId: undefined,
  });

  persistArchiveEntityById(created.id);

  return {
    success: true,
    data: { entityId: created.id },
  };
};

const updateEntityNameHandler: CommandHandler<
  UpdateWorldArchiveEntityNamePayload,
  void
> = async (
  command: Command<UpdateWorldArchiveEntityNamePayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, name } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().updateEntityName(entityId, name);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const updateEntityEssenceHandler: CommandHandler<
  UpdateWorldArchiveEntityEssencePayload,
  void
> = async (
  command: Command<UpdateWorldArchiveEntityEssencePayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, essence } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().updateEssence(entityId, essence);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const updateEntityStateHandler: CommandHandler<
  UpdateWorldArchiveEntityStatePayload,
  void
> = async (
  command: Command<UpdateWorldArchiveEntityStatePayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, currentState } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().updateEntityState(entityId, currentState);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const updateEntityPresenceHandler: CommandHandler<
  UpdateWorldArchiveEntityPresencePayload,
  void
> = async (
  command: Command<UpdateWorldArchiveEntityPresencePayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, presence } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().updateEntityPresence(entityId, presence);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const addRelationshipHandler: CommandHandler<
  AddWorldArchiveRelationshipPayload,
  void
> = async (
  command: Command<AddWorldArchiveRelationshipPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, relationship } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().addRelationship(entityId, relationship);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const updateRelationshipHandler: CommandHandler<
  UpdateWorldArchiveRelationshipPayload,
  void
> = async (
  command: Command<UpdateWorldArchiveRelationshipPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, relationshipId, updates } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore
    .getState()
    .updateRelationship(entityId, relationshipId, updates);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const removeRelationshipHandler: CommandHandler<
  RemoveWorldArchiveRelationshipPayload,
  void
> = async (
  command: Command<RemoveWorldArchiveRelationshipPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, relationshipId } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().removeRelationship(entityId, relationshipId);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const updateTagsHandler: CommandHandler<
  UpdateWorldArchiveTagsPayload,
  void
> = async (
  command: Command<UpdateWorldArchiveTagsPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { entityId, tags } = command.payload;

  const missingEntityResult = ensureEntityExists(entityId);
  if (missingEntityResult) {
    return missingEntityResult;
  }

  useWorldArchiveStore.getState().updateTags(entityId, tags);
  persistArchiveEntityById(entityId);

  return { success: true };
};

const syncPipelineChangesHandler: CommandHandler<
  SyncPipelineArchiveChangesPayload,
  void
> = async (
  command: Command<SyncPipelineArchiveChangesPayload>,
  _context: CommandContext,
): Promise<CommandResult<void>> => {
  const { currentTurn, createdNpcs, archiveUpdates } = command.payload;

  if (createdNpcs && createdNpcs.length > 0) {
    autoRegisterNpcs(createdNpcs as CreatedNpcData[], currentTurn);
  }

  if (archiveUpdates && archiveUpdates.length > 0) {
    applyArchiveUpdatesAndSync(archiveUpdates as ArchiveUpdate[], currentTurn);
  }

  return { success: true };
};

function createWorldArchiveCommandHandlers(): Record<
  string,
  CommandHandler<unknown, unknown>
> {
  return {
    [WorldArchiveCommands.CREATE_ENTITY]: createEntityHandler as CommandHandler<
      unknown,
      unknown
    >,
    [WorldArchiveCommands.UPDATE_ENTITY_NAME]:
      updateEntityNameHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.UPDATE_ENTITY_ESSENCE]:
      updateEntityEssenceHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.UPDATE_ENTITY_STATE]:
      updateEntityStateHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.UPDATE_ENTITY_PRESENCE]:
      updateEntityPresenceHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.ADD_RELATIONSHIP]:
      addRelationshipHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.UPDATE_RELATIONSHIP]:
      updateRelationshipHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.REMOVE_RELATIONSHIP]:
      removeRelationshipHandler as CommandHandler<unknown, unknown>,
    [WorldArchiveCommands.UPDATE_TAGS]: updateTagsHandler as CommandHandler<
      unknown,
      unknown
    >,
    [WorldArchiveCommands.SYNC_PIPELINE_CHANGES]:
      syncPipelineChangesHandler as CommandHandler<unknown, unknown>,
  };
}

const manifest: ModuleManifest = {
  id: "lyra.world-archive",
  version: "0.1.0",
  commands: createWorldArchiveCommandHandlers(),
  eventHandlers: {
    [SaveEvents.SAVE_LOADED]: () => {
      rebuildSyncBridgeForCurrentSave();
    },
    [SaveEvents.SAVE_DELETED]: (event) => {
      const payload = event.payload as SaveDeletedPayload;
      if (payload.isCurrentSave) {
        destroySyncBridge(true);
      }
    },
  },
};

export async function registerWorldArchiveModule(): Promise<void> {
  await registry.register(manifest);
  snapshotRegistry.register("lyra.world-archive", worldArchiveSnapshotFields);
  rebuildSyncBridgeForCurrentSave();
}

export async function unregisterWorldArchiveModule(): Promise<void> {
  destroySyncBridge(true);
  snapshotRegistry.unregister("lyra.world-archive");
  await registry.unregister("lyra.world-archive");
}

export type {
  ArchiveSnapshot,
  ArchiveUpdate,
  EntityArchetype,
  EntityPresence,
  EntityRelationship,
  EntityRelationshipInput,
  NarrativeEntity,
} from "./types";
export {
  applyArchiveUpdatesAndSync,
  autoRegisterNpcs,
  computeArchiveData,
  saveArchiveEntity,
  saveArchiveEntityById,
  useWorldArchiveStore,
};
