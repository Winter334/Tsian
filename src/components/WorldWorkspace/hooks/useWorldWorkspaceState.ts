/**
 * 世界工作台状态桥接 Hook
 *
 * 负责连接作者态世界 Store，并在 UI 层管理：
 * - 当前选中的世界 ID
 * - 草稿副本与脏标记
 * - 保存 / 重置 / 导入 / 导出
 * - 原始规则编辑开关与文本状态
 * - 移动端页面切换
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ItemTemplate } from "@/domain/entities/item";
import type { SkillTemplate } from "@/domain/entities/skill";
import { defaultWorld, useWorldStore, type WorldIndex } from "@/lib/world";
import type {
  CharacterDimension,
  CheckRuleConfig,
  ConditionConfig,
  DerivedStatConfig,
  DimensionOption,
  EquipSlotDefinition,
  LevelSystemConfig,
  PointBuyRules,
  PrimaryAttributeConfig,
  TalentConfig,
  World,
  WorldConfig,
  WorldId,
  WorldMeta,
  WorldNarrativeSeed,
} from "@/lib/world/types";

import {
  cloneValue,
  isRecord,
  isWorldConfig,
  normalizeCheckRules,
  normalizeCondition,
  normalizeDCPreset,
  normalizeDerivedStat,
  normalizeDimension,
  normalizeDimensionOption,
  normalizeEquipSlotDefinition,
  normalizeInventoryRules,
  normalizeItemTemplate,
  normalizeLevelSystem,
  normalizeNarrative,
  normalizeOpposedPreset,
  normalizePointBuyRules,
  normalizePrimaryAttribute,
  normalizeSkillTemplate,
  normalizeTalent,
  normalizeTalentPityRule,
  normalizeTalentPool,
  normalizeTalentRarity,
  normalizeTalentRules,
  normalizeWorld,
  normalizeWorldRules,
  toNumber,
  toOptionalString,
  toRequiredString,
} from "./world-workspace-normalizers";
import {
  applyRawRulesEditorPayload,
  EMPTY_RULES_JSON,
  getRawRulesEditorText,
  getRawRulesEditorTextFromWorld,
} from "./world-workspace-raw-rules";
import type {
  WorldRulesEditorScope,
  WorldWorkspaceMobilePage,
} from "./world-workspace-types";
import { buildWorldValidationMessages } from "./world-workspace-validation";

export type {
  WorldRulesEditorScope,
  WorldScopedRulesEditorScope,
  WorldWorkspaceMobilePage,
} from "./world-workspace-types";

type EditableWorldMeta = Pick<
  WorldMeta,
  "name" | "description" | "author" | "version" | "source"
>;

type EditableTalentRules = NonNullable<WorldConfig["talentRules"]>;
type EditableTalentRarity = NonNullable<
  EditableTalentRules["rarities"]
>[number];
type EditableTalentPool = NonNullable<EditableTalentRules["pools"]>[number];
type EditableTalentPityRule = NonNullable<EditableTalentRules["pity"]>[number];

type EditableDCPresets = NonNullable<CheckRuleConfig["dcPresets"]>;
type EditableDCPreset = EditableDCPresets[string];
type EditableOpposedPresets = NonNullable<CheckRuleConfig["opposedPresets"]>;
type EditableOpposedPreset = EditableOpposedPresets[string];
type EditableDCGuidelineScaleItem = NonNullable<
  CheckRuleConfig["dcGuideline"]
>["scale"][number];

type EditableWorldSnapshot = {
  meta: EditableWorldMeta;
  rules: WorldConfig;
  narrative: WorldNarrativeSeed;
};

export interface WorldWorkspaceState {
  worlds: WorldIndex[];
  activeWorldId: WorldId | null;
  selectedWorldId: WorldId | null;
  selectedWorld: World | null;
  draft: World | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoadingWorld: boolean;
  rawRulesEditorOpen: boolean;
  rawRulesEditorScope: WorldRulesEditorScope;
  rawRulesText: string;
  rawRulesError: string | null;
  mobilePage: WorldWorkspaceMobilePage;
  validationMessages: string[];
  resetToBuiltinDefault: () => void;
}

export interface WorldWorkspaceActions {
  selectWorld: (id: WorldId) => void;
  setActiveWorld: (id: WorldId) => void;
  createWorld: (onCreated?: (world: World) => void) => void;
  deleteWorld: (id: WorldId) => void;
  confirmDeleteWorld: () => Promise<void>;
  cancelDeleteWorld: () => void;
  saveSelectedWorld: () => Promise<World | null>;
  resetDraft: () => void;
  setMobilePage: (page: WorldWorkspaceMobilePage) => void;
  openRawRulesEditor: (scope: WorldRulesEditorScope) => void;
  closeRawRulesEditor: () => void;
  setRawRulesText: (value: string) => void;
  applyRawRulesText: () => void;
  exportSelectedWorld: () => void;
  importWorldFromFile: (
    file: File,
    callbacks?: {
      onSuccess?: (world: World) => void;
      onError?: (err: Error) => void;
    },
  ) => void;
  updateMeta: (updates: Partial<EditableWorldMeta>) => void;
  updateNarrative: (updates: Partial<WorldNarrativeSeed>) => void;
  updatePrimaryAttribute: (
    index: number,
    updates: Partial<PrimaryAttributeConfig>,
  ) => void;
  addPrimaryAttribute: () => void;
  removePrimaryAttribute: (index: number) => void;
  updatePointBuyRules: (updates: Partial<PointBuyRules>) => void;
  updateCheckRules: (updates: Partial<CheckRuleConfig>) => void;
  addDcPreset: () => void;
  updateDcPreset: (
    presetKey: string,
    updates: Partial<EditableDCPreset>,
  ) => void;
  removeDcPreset: (presetKey: string) => void;
  addOpposedPreset: () => void;
  updateOpposedPreset: (
    presetKey: string,
    updates: Partial<EditableOpposedPreset>,
  ) => void;
  removeOpposedPreset: (presetKey: string) => void;
  addDCGuidelineItem: () => void;
  updateDCGuidelineItem: (
    index: number,
    updates: Partial<EditableDCGuidelineScaleItem>,
  ) => void;
  removeDCGuidelineItem: (index: number) => void;
  updateDerivedStat: (
    index: number,
    updates: Partial<DerivedStatConfig>,
  ) => void;
  addDerivedStat: () => void;
  removeDerivedStat: (index: number) => void;
  updateDimension: (
    index: number,
    updates: Partial<CharacterDimension>,
  ) => void;
  addDimension: () => void;
  removeDimension: (index: number) => void;
  updateDimensionOption: (
    dimensionIndex: number,
    optionIndex: number,
    updates: Partial<DimensionOption>,
  ) => void;
  addDimensionOption: (dimensionIndex: number) => void;
  removeDimensionOption: (dimensionIndex: number, optionIndex: number) => void;
  updateCondition: (index: number, updates: Partial<ConditionConfig>) => void;
  addCondition: () => void;
  removeCondition: (index: number) => void;
  updateTalentRules: (updates: Partial<EditableTalentRules>) => void;
  addTalentRarity: () => void;
  removeTalentRarity: (id: string) => void;
  updateTalentRarity: (
    id: string,
    updates: Partial<EditableTalentRarity>,
  ) => void;
  addTalentPool: () => void;
  removeTalentPool: (id: string) => void;
  updateTalentPool: (id: string, updates: Partial<EditableTalentPool>) => void;
  addTalentPityRule: () => void;
  removeTalentPityRule: (index: number) => void;
  updateTalentPityRule: (
    index: number,
    updates: Partial<EditableTalentPityRule>,
  ) => void;
  updateLevelSystem: (updates: Partial<LevelSystemConfig>) => void;
  updateTalent: (index: number, updates: Partial<TalentConfig>) => void;
  addTalent: () => void;
  removeTalent: (index: number) => void;
  addEquipSlot: () => void;
  updateEquipSlot: (
    index: number,
    updates: Partial<EquipSlotDefinition>,
  ) => void;
  removeEquipSlot: (index: number) => void;
  updateDefaultCapacity: (value: number | undefined) => void;
  updateItemTemplate: (index: number, updates: Partial<ItemTemplate>) => void;
  addItemTemplate: () => void;
  removeItemTemplate: (index: number) => void;
  updateSkillTemplate: (index: number, updates: Partial<SkillTemplate>) => void;
  addSkillTemplate: () => void;
  removeSkillTemplate: (index: number) => void;
  pendingDeleteWorld: { id: WorldId; name: string } | null;
  discardConfirm: {
    open: boolean;
    message: string;
  };
  handleConfirmDiscard: () => void;
  handleCancelDiscard: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getNextWorldName(worlds: WorldIndex[]): string {
  const baseName = "新世界";
  const existingNames = new Set(worlds.map((item) => item.name));

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let index = 2;
  while (existingNames.has(`${baseName} ${index}`)) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

function getUniquePrimaryAttributeKey(rules: WorldConfig): string {
  const existingKeys = new Set(rules.primaryAttributes.map((item) => item.key));
  let index = rules.primaryAttributes.length + 1;

  while (existingKeys.has(`attr_${index}`)) {
    index += 1;
  }

  return `attr_${index}`;
}

function getUniqueDerivedStatKey(rules: WorldConfig): string {
  const existingKeys = new Set([
    ...rules.primaryAttributes.map((item) => item.key),
    ...rules.derivedStats.map((item) => item.key),
  ]);
  let index = rules.derivedStats.length + 1;

  while (existingKeys.has(`derived_${index}`)) {
    index += 1;
  }

  return `derived_${index}`;
}

function getUniqueRuleRecordKey(
  existingKeys: Iterable<string>,
  prefix: string,
): string {
  const usedKeys = new Set(existingKeys);
  let index = usedKeys.size + 1;

  while (usedKeys.has(`${prefix}_${index}`)) {
    index += 1;
  }

  return `${prefix}_${index}`;
}

function getUniqueEquipSlotId(rules: WorldConfig): string {
  const existingIds = new Set(
    (rules.inventoryRules?.equipSlotDefinitions ?? []).map((item) => item.id),
  );
  let index = (rules.inventoryRules?.equipSlotDefinitions?.length ?? 0) + 1;

  while (existingIds.has(`equip_slot_${index}`)) {
    index += 1;
  }

  return `equip_slot_${index}`;
}

function getEditableSnapshot(
  world: World | null,
): EditableWorldSnapshot | null {
  if (!world) {
    return null;
  }

  const normalized = normalizeWorld(world);
  return {
    meta: {
      name: normalized.meta.name,
      description: normalized.meta.description,
      author: normalized.meta.author,
      version: normalized.meta.version,
      source: normalized.meta.source,
    },
    rules: normalized.rules,
    narrative: normalized.narrative ?? {},
  };
}

function downloadWorld(world: World): void {
  const content = JSON.stringify(normalizeWorld(world), null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${world.meta.name || "world"}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function parseImportedWorld(value: unknown): World {
  if (!isRecord(value)) {
    throw new Error("导入文件不是有效的世界对象");
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new Error("导入文件缺少 world.id");
  }

  if (!isRecord(value.meta)) {
    throw new Error("导入文件缺少 world.meta");
  }

  if (!isWorldConfig(value.rules)) {
    throw new Error("导入文件缺少有效的 world.rules");
  }

  const source = value.meta.source;
  if (source !== "lyra" && source !== "custom") {
    throw new Error("导入文件的 meta.source 非法");
  }

  const imported: World = {
    id: value.id,
    meta: {
      name: toRequiredString(value.meta.name, "未命名世界"),
      description: toOptionalString(value.meta.description),
      author: toOptionalString(value.meta.author),
      version: toRequiredString(value.meta.version, "1.0.0"),
      createdAt: toNumber(value.meta.createdAt, Date.now()),
      updatedAt: toNumber(value.meta.updatedAt, Date.now()),
      source,
    },
    rules: normalizeWorldRules(
      value.id,
      toRequiredString(value.meta.name, "未命名世界"),
      value.rules,
    ),
    narrative: normalizeNarrative(value.narrative),
  };

  return normalizeWorld(imported);
}

export function useWorldWorkspaceState(): WorldWorkspaceState &
  WorldWorkspaceActions {
  const worlds = useWorldStore((state) => state.worlds);
  const activeWorldId = useWorldStore((state) => state.activeWorldId);
  const getWorld = useWorldStore((state) => state.getWorld);
  const createWorldInStore = useWorldStore((state) => state.createWorld);
  const updateWorldInStore = useWorldStore((state) => state.updateWorld);
  const deleteWorldInStore = useWorldStore((state) => state.deleteWorld);
  const setActiveWorldInStore = useWorldStore((state) => state.setActiveWorld);

  const [selectedWorldId, setSelectedWorldId] = useState<WorldId | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [draft, setDraft] = useState<World | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWorld, setIsLoadingWorld] = useState(false);
  const [rawRulesEditorOpen, setRawRulesEditorOpenState] = useState(false);
  const [rawRulesEditorScope, setRawRulesEditorScope] =
    useState<WorldRulesEditorScope>("full");
  const [rawRulesText, setRawRulesTextState] = useState(EMPTY_RULES_JSON);
  const [rawRulesError, setRawRulesError] = useState<string | null>(null);
  const [mobilePage, setMobilePage] =
    useState<WorldWorkspaceMobilePage>("list");
  const [pendingDeleteWorld, setPendingDeleteWorld] = useState<{
    id: WorldId;
    name: string;
  } | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState<{
    open: boolean;
    message: string;
    onConfirm: (() => void) | null;
  }>({ open: false, message: "", onConfirm: null });

  const isDirty = useMemo(() => {
    const baseSnapshot = getEditableSnapshot(selectedWorld);
    const draftSnapshot = getEditableSnapshot(draft);

    if (!baseSnapshot || !draftSnapshot) {
      return false;
    }

    return JSON.stringify(baseSnapshot) !== JSON.stringify(draftSnapshot);
  }, [draft, selectedWorld]);

  const validationMessages = useMemo(
    () => buildWorldValidationMessages(draft),
    [draft],
  );

  const updateDraft = useCallback((updater: (current: World) => World) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const next = updater(cloneValue(current));
      return normalizeWorld(next);
    });
  }, []);

  const syncRawRulesFromDraft = useCallback(
    (world: World | null, scope: WorldRulesEditorScope = "full") => {
      setRawRulesTextState(getRawRulesEditorTextFromWorld(world, scope));
      setRawRulesError(null);
    },
    [],
  );

  const confirmDiscardChanges = useCallback(
    (
      onConfirm: () => void,
      message = "当前世界有未保存修改，继续操作会丢失这些更改。是否继续？",
    ) => {
      if (!isDirty) {
        onConfirm();
        return;
      }
      setDiscardConfirm({ open: true, message, onConfirm });
    },
    [isDirty],
  );

  const handleConfirmDiscard = useCallback(() => {
    discardConfirm.onConfirm?.();
    setDiscardConfirm({ open: false, message: "", onConfirm: null });
  }, [discardConfirm]);

  const handleCancelDiscard = useCallback(() => {
    setDiscardConfirm({ open: false, message: "", onConfirm: null });
  }, []);

  useEffect(() => {
    if (worlds.length === 0) {
      setSelectedWorldId(null);
      setSelectedWorld(null);
      setDraft(null);
      setRawRulesEditorScope("full");
      syncRawRulesFromDraft(null, "full");
      setMobilePage("list");
      return;
    }

    if (!selectedWorldId) {
      setSelectedWorldId(activeWorldId ?? worlds[0]?.id ?? null);
      return;
    }

    const exists = worlds.some((item) => item.id === selectedWorldId);
    if (!exists) {
      setSelectedWorldId(activeWorldId ?? worlds[0]?.id ?? null);
    }
  }, [activeWorldId, selectedWorldId, syncRawRulesFromDraft, worlds]);

  useEffect(() => {
    let disposed = false;

    async function loadSelectedWorld(): Promise<void> {
      if (!selectedWorldId) {
        setSelectedWorld(null);
        setDraft(null);
        syncRawRulesFromDraft(null);
        setIsLoadingWorld(false);
        return;
      }

      setIsLoadingWorld(true);
      const nextWorld = await getWorld(selectedWorldId);

      if (disposed) {
        return;
      }

      const normalizedWorld = normalizeWorld(nextWorld ?? defaultWorld);
      setSelectedWorld(normalizedWorld);
      setDraft(cloneValue(normalizedWorld));
      setRawRulesEditorOpenState(false);
      setRawRulesEditorScope("full");
      syncRawRulesFromDraft(normalizedWorld, "full");
      setIsLoadingWorld(false);
    }

    void loadSelectedWorld();

    return () => {
      disposed = true;
    };
  }, [getWorld, selectedWorldId, syncRawRulesFromDraft]);

  const selectWorld = useCallback(
    (id: WorldId) => {
      if (id === selectedWorldId) {
        setMobilePage("editor");
        return;
      }

      confirmDiscardChanges(() => {
        setSelectedWorldId(id);
        setMobilePage("editor");
      });
    },
    [confirmDiscardChanges, selectedWorldId],
  );

  const setActiveWorld = useCallback(
    (id: WorldId) => {
      setActiveWorldInStore(id);
    },
    [setActiveWorldInStore],
  );

  const createWorld = useCallback(
    (onCreated?: (world: World) => void) => {
      confirmDiscardChanges(async () => {
        const name = getNextWorldName(worlds);
        const world = await createWorldInStore(name, "");
        setActiveWorldInStore(world.id);
        setSelectedWorldId(world.id);
        setMobilePage("editor");
        const normalized = normalizeWorld({
          ...world,
          narrative: world.narrative ?? {},
          rules: normalizeWorldRules(world.id, world.meta.name, world.rules),
        });
        onCreated?.(normalized);
      }, "新建世界会放弃当前未保存修改。是否继续？");
    },
    [confirmDiscardChanges, createWorldInStore, setActiveWorldInStore, worlds],
  );

  const deleteWorld = useCallback(
    (id: WorldId) => {
      const target = worlds.find((item) => item.id === id);
      const targetName = target?.name ?? "该世界";
      setPendingDeleteWorld({ id, name: targetName });
    },
    [worlds],
  );

  const confirmDeleteWorld = useCallback(async () => {
    if (!pendingDeleteWorld) return;
    await deleteWorldInStore(pendingDeleteWorld.id);
    setPendingDeleteWorld(null);
  }, [deleteWorldInStore, pendingDeleteWorld]);

  const cancelDeleteWorld = useCallback(() => {
    setPendingDeleteWorld(null);
  }, []);

  const saveSelectedWorld = useCallback(async () => {
    if (!draft) {
      return null;
    }

    const normalizedDraft = normalizeWorld(draft);
    setIsSaving(true);

    try {
      await updateWorldInStore(normalizedDraft.id, {
        meta: {
          name: normalizedDraft.meta.name,
          description: normalizedDraft.meta.description,
          author: normalizedDraft.meta.author,
          version: normalizedDraft.meta.version,
          source: normalizedDraft.meta.source,
        },
        rules: normalizeWorldRules(
          normalizedDraft.id,
          normalizedDraft.meta.name,
          normalizedDraft.rules,
        ),
        narrative: normalizeNarrative(normalizedDraft.narrative),
      });

      const persisted = await getWorld(normalizedDraft.id);
      const nextWorld = normalizeWorld(persisted ?? normalizedDraft);
      setSelectedWorld(nextWorld);
      setDraft(cloneValue(nextWorld));
      syncRawRulesFromDraft(nextWorld, rawRulesEditorScope);
      return nextWorld;
    } finally {
      setIsSaving(false);
    }
  }, [
    draft,
    getWorld,
    rawRulesEditorScope,
    syncRawRulesFromDraft,
    updateWorldInStore,
  ]);

  const resetDraft = useCallback(() => {
    if (!selectedWorld) {
      return;
    }

    const nextWorld = normalizeWorld(selectedWorld);
    setDraft(cloneValue(nextWorld));
    setRawRulesEditorOpenState(false);
    setRawRulesEditorScope("full");
    syncRawRulesFromDraft(nextWorld, "full");
  }, [selectedWorld, syncRawRulesFromDraft]);

  const resetToBuiltinDefault = useCallback(() => {
    if (!draft) return;

    updateDraft((current) => {
      current.rules = {
        ...defaultWorld.rules,
        worldId: current.id,
        worldName: current.meta.name,
      };
      current.narrative = { ...defaultWorld.narrative };
      current.rules = normalizeWorldRules(
        current.id,
        current.meta.name,
        current.rules,
      );
      return current;
    });
  }, [draft, updateDraft]);

  const openRawRulesEditor = useCallback(
    (scope: WorldRulesEditorScope) => {
      setRawRulesEditorScope(scope);
      setRawRulesEditorOpenState(true);
      setRawRulesError(null);
      syncRawRulesFromDraft(draft, scope);
    },
    [draft, syncRawRulesFromDraft],
  );

  const closeRawRulesEditor = useCallback(() => {
    setRawRulesEditorOpenState(false);
    setRawRulesError(null);
  }, []);

  const setRawRulesText = useCallback((value: string) => {
    setRawRulesTextState(value);
    setRawRulesError(null);
  }, []);

  const applyRawRulesText = useCallback(() => {
    if (!draft) {
      return;
    }

    try {
      const parsed = JSON.parse(rawRulesText) as unknown;
      const nextRules = applyRawRulesEditorPayload(
        draft,
        rawRulesEditorScope,
        parsed,
      );

      updateDraft((current) => {
        current.rules = nextRules;
        return current;
      });
      setRawRulesTextState(
        getRawRulesEditorText(nextRules, rawRulesEditorScope),
      );
      setRawRulesError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "原始规则解析失败";
      setRawRulesError(message);
      throw error;
    }
  }, [draft, rawRulesEditorScope, rawRulesText, updateDraft]);

  const exportSelectedWorld = useCallback(() => {
    if (!draft) {
      return;
    }

    downloadWorld(draft);
  }, [draft]);

  const importWorldFromFile = useCallback(
    (
      file: File,
      callbacks?: {
        onSuccess?: (world: World) => void;
        onError?: (err: Error) => void;
      },
    ) => {
      confirmDiscardChanges(async () => {
        try {
          const text = await file.text();
          let parsed: unknown;

          try {
            parsed = JSON.parse(text) as unknown;
          } catch {
            throw new Error("世界文件不是有效的 JSON");
          }

          const importedWorld = parseImportedWorld(parsed);
          const createdWorld = await createWorldInStore(
            importedWorld.meta.name,
            importedWorld.meta.description,
          );

          await updateWorldInStore(createdWorld.id, {
            meta: {
              name: importedWorld.meta.name,
              description: importedWorld.meta.description,
              author: importedWorld.meta.author,
              version: importedWorld.meta.version,
              source: "custom",
            },
            rules: normalizeWorldRules(
              createdWorld.id,
              importedWorld.meta.name,
              importedWorld.rules,
            ),
            narrative: normalizeNarrative(importedWorld.narrative),
          });

          setActiveWorldInStore(createdWorld.id);
          setSelectedWorldId(createdWorld.id);
          setMobilePage("editor");

          const persisted = await getWorld(createdWorld.id);
          const normalized = normalizeWorld(persisted ?? createdWorld);
          callbacks?.onSuccess?.(normalized);
        } catch (err) {
          callbacks?.onError?.(
            err instanceof Error ? err : new Error("未知错误"),
          );
        }
      }, "导入新世界会切换当前编辑对象，是否继续？");
    },
    [
      confirmDiscardChanges,
      createWorldInStore,
      getWorld,
      setActiveWorldInStore,
      updateWorldInStore,
    ],
  );

  const updateMeta = useCallback(
    (updates: Partial<EditableWorldMeta>) => {
      updateDraft((current) => {
        current.meta = {
          ...current.meta,
          ...updates,
        };

        if (updates.name) {
          current.rules.worldName = updates.name;
        }

        current.rules = normalizeWorldRules(
          current.id,
          current.meta.name,
          current.rules,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const updateNarrative = useCallback(
    (updates: Partial<WorldNarrativeSeed>) => {
      updateDraft((current) => {
        current.narrative = normalizeNarrative({
          ...(current.narrative ?? {}),
          ...updates,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updatePrimaryAttribute = useCallback(
    (index: number, updates: Partial<PrimaryAttributeConfig>) => {
      updateDraft((current) => {
        const target = current.rules.primaryAttributes[index];
        if (!target) {
          return current;
        }

        const previousKey = target.key;
        current.rules.primaryAttributes[index] = normalizePrimaryAttribute(
          {
            ...target,
            ...updates,
          },
          index,
        );

        const nextKey = current.rules.primaryAttributes[index].key;
        if (
          previousKey !== nextKey &&
          current.rules.pointBuyRules?.allocatableAttributes
        ) {
          current.rules.pointBuyRules.allocatableAttributes =
            current.rules.pointBuyRules.allocatableAttributes.map((item) =>
              item === previousKey ? nextKey : item,
            );
        }

        return current;
      });
    },
    [updateDraft],
  );

  const addPrimaryAttribute = useCallback(() => {
    updateDraft((current) => {
      const key = getUniquePrimaryAttributeKey(current.rules);
      current.rules.primaryAttributes.push({
        key,
        label: `属性 ${current.rules.primaryAttributes.length + 1}`,
        defaultValue: 10,
        min: 0,
        max: 20,
        description: "",
      });
      return current;
    });
  }, [updateDraft]);

  const removePrimaryAttribute = useCallback(
    (index: number) => {
      updateDraft((current) => {
        const target = current.rules.primaryAttributes[index];
        if (!target) {
          return current;
        }

        current.rules.primaryAttributes.splice(index, 1);
        if (current.rules.pointBuyRules?.allocatableAttributes) {
          current.rules.pointBuyRules.allocatableAttributes =
            current.rules.pointBuyRules.allocatableAttributes.filter(
              (item) => item !== target.key,
            );
        }
        return current;
      });
    },
    [updateDraft],
  );

  const updatePointBuyRules = useCallback(
    (updates: Partial<PointBuyRules>) => {
      updateDraft((current) => {
        const nextPointBuyRules = normalizePointBuyRules({
          ...(current.rules.pointBuyRules ?? {
            allocatableAttributes: [],
            bonusPoints: 10,
          }),
          ...updates,
        });

        current.rules.pointBuyRules = nextPointBuyRules;
        return current;
      });
    },
    [updateDraft],
  );

  const updateCheckRules = useCallback(
    (updates: Partial<CheckRuleConfig>) => {
      updateDraft((current) => {
        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          ...updates,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addDcPreset = useCallback(() => {
    updateDraft((current) => {
      const currentPresets = current.rules.checkRules.dcPresets ?? {};
      const presetKey = getUniqueRuleRecordKey(
        Object.keys(currentPresets),
        "dc_preset",
      );
      current.rules.checkRules = normalizeCheckRules({
        ...current.rules.checkRules,
        dcPresets: {
          ...currentPresets,
          [presetKey]: normalizeDCPreset(
            {},
            Object.keys(currentPresets).length,
          ),
        },
      });
      return current;
    });
  }, [updateDraft]);

  const updateDcPreset = useCallback(
    (presetKey: string, updates: Partial<EditableDCPreset>) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.dcPresets ?? {};
        const target = currentPresets[presetKey];
        if (!target) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcPresets: {
            ...currentPresets,
            [presetKey]: normalizeDCPreset(
              {
                ...target,
                ...updates,
              },
              Object.keys(currentPresets).indexOf(presetKey),
            ),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeDcPreset = useCallback(
    (presetKey: string) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.dcPresets;
        if (!currentPresets?.[presetKey]) {
          return current;
        }

        const { [presetKey]: _removed, ...rest } = currentPresets;
        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcPresets: rest,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addOpposedPreset = useCallback(() => {
    updateDraft((current) => {
      const currentPresets = current.rules.checkRules.opposedPresets ?? {};
      const presetKey = getUniqueRuleRecordKey(
        Object.keys(currentPresets),
        "opposed_preset",
      );
      current.rules.checkRules = normalizeCheckRules({
        ...current.rules.checkRules,
        opposedPresets: {
          ...currentPresets,
          [presetKey]: normalizeOpposedPreset(
            {},
            Object.keys(currentPresets).length,
          ),
        },
      });
      return current;
    });
  }, [updateDraft]);

  const updateOpposedPreset = useCallback(
    (presetKey: string, updates: Partial<EditableOpposedPreset>) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.opposedPresets ?? {};
        const target = currentPresets[presetKey];
        if (!target) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          opposedPresets: {
            ...currentPresets,
            [presetKey]: normalizeOpposedPreset(
              {
                ...target,
                ...updates,
              },
              Object.keys(currentPresets).indexOf(presetKey),
            ),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeOpposedPreset = useCallback(
    (presetKey: string) => {
      updateDraft((current) => {
        const currentPresets = current.rules.checkRules.opposedPresets;
        if (!currentPresets?.[presetKey]) {
          return current;
        }

        const { [presetKey]: _removed, ...rest } = currentPresets;
        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          opposedPresets: rest,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addDCGuidelineItem = useCallback(() => {
    updateDraft((current) => {
      const scale = current.rules.checkRules.dcGuideline?.scale ?? [];
      current.rules.checkRules = normalizeCheckRules({
        ...current.rules.checkRules,
        dcGuideline: {
          scale: [
            ...scale,
            {
              label: `难度 ${scale.length + 1}`,
              dc: 10,
              description: "",
            },
          ],
        },
      });
      return current;
    });
  }, [updateDraft]);

  const updateDCGuidelineItem = useCallback(
    (index: number, updates: Partial<EditableDCGuidelineScaleItem>) => {
      updateDraft((current) => {
        const scale = current.rules.checkRules.dcGuideline?.scale ?? [];
        const target = scale[index];
        if (!target) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcGuideline: {
            scale: scale.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    ...updates,
                  }
                : item,
            ),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeDCGuidelineItem = useCallback(
    (index: number) => {
      updateDraft((current) => {
        const scale = current.rules.checkRules.dcGuideline?.scale ?? [];
        if (!scale[index]) {
          return current;
        }

        current.rules.checkRules = normalizeCheckRules({
          ...current.rules.checkRules,
          dcGuideline: {
            scale: scale.filter((_, itemIndex) => itemIndex !== index),
          },
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateDerivedStat = useCallback(
    (index: number, updates: Partial<DerivedStatConfig>) => {
      updateDraft((current) => {
        const target = current.rules.derivedStats[index];
        if (!target) {
          return current;
        }

        current.rules.derivedStats[index] = normalizeDerivedStat(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addDerivedStat = useCallback(() => {
    updateDraft((current) => {
      current.rules.derivedStats.push({
        key: getUniqueDerivedStatKey(current.rules),
        label: `衍生属性 ${current.rules.derivedStats.length + 1}`,
        formula: "0",
        showInUI: true,
      });
      return current;
    });
  }, [updateDraft]);

  const removeDerivedStat = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.derivedStats[index]) {
          return current;
        }

        current.rules.derivedStats.splice(index, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateDimension = useCallback(
    (index: number, updates: Partial<CharacterDimension>) => {
      updateDraft((current) => {
        const target = current.rules.dimensions?.[index];
        if (!target) {
          return current;
        }

        current.rules.dimensions![index] = normalizeDimension(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addDimension = useCallback(() => {
    updateDraft((current) => {
      current.rules.dimensions = current.rules.dimensions ?? [];
      current.rules.dimensions.push({
        id: generateId("dimension"),
        label: `维度 ${current.rules.dimensions.length + 1}`,
        description: "",
        required: true,
        order: current.rules.dimensions.length,
        options: [],
      });
      return current;
    });
  }, [updateDraft]);

  const removeDimension = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.dimensions?.[index]) {
          return current;
        }

        current.rules.dimensions.splice(index, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateDimensionOption = useCallback(
    (
      dimensionIndex: number,
      optionIndex: number,
      updates: Partial<DimensionOption>,
    ) => {
      updateDraft((current) => {
        const targetDimension = current.rules.dimensions?.[dimensionIndex];
        const targetOption = targetDimension?.options?.[optionIndex];

        if (!targetDimension || !targetOption) {
          return current;
        }

        targetDimension.options[optionIndex] = normalizeDimensionOption(
          {
            ...targetOption,
            ...updates,
          },
          optionIndex,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addDimensionOption = useCallback(
    (dimensionIndex: number) => {
      updateDraft((current) => {
        const targetDimension = current.rules.dimensions?.[dimensionIndex];
        if (!targetDimension) {
          return current;
        }

        targetDimension.options.push({
          id: generateId("option"),
          name: `选项 ${targetDimension.options.length + 1}`,
          description: "",
          effects: undefined,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeDimensionOption = useCallback(
    (dimensionIndex: number, optionIndex: number) => {
      updateDraft((current) => {
        const targetDimension = current.rules.dimensions?.[dimensionIndex];
        if (!targetDimension?.options?.[optionIndex]) {
          return current;
        }

        targetDimension.options.splice(optionIndex, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateCondition = useCallback(
    (index: number, updates: Partial<ConditionConfig>) => {
      updateDraft((current) => {
        current.rules.conditions = current.rules.conditions ?? [];
        const target = current.rules.conditions[index];
        if (!target) {
          return current;
        }

        current.rules.conditions[index] = normalizeCondition(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addCondition = useCallback(() => {
    updateDraft((current) => {
      current.rules.conditions = current.rules.conditions ?? [];
      current.rules.conditions.push({
        id: generateId("condition"),
        name: `状态 ${current.rules.conditions.length + 1}`,
        description: "",
      });
      current.rules.conditions = current.rules.conditions.map((item, index) =>
        normalizeCondition(item, index),
      );
      return current;
    });
  }, [updateDraft]);

  const removeCondition = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.conditions?.[index]) {
          return current;
        }

        current.rules.conditions.splice(index, 1);
        current.rules.conditions = current.rules.conditions.map(
          (item, itemIndex) => normalizeCondition(item, itemIndex),
        );
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalentRules = useCallback(
    (updates: Partial<EditableTalentRules>) => {
      updateDraft((current) => {
        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          ...updates,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addTalentRarity = useCallback(() => {
    updateDraft((current) => {
      const rarities = current.rules.talentRules?.rarities ?? [];
      current.rules.talentRules = normalizeTalentRules({
        ...(current.rules.talentRules ?? {}),
        rarities: [
          ...rarities,
          normalizeTalentRarity(
            {
              id: generateId("rarity"),
              label: `品质 ${rarities.length + 1}`,
              weight: 1,
            },
            rarities.length,
          ),
        ],
      });
      return current;
    });
  }, [updateDraft]);

  const removeTalentRarity = useCallback(
    (id: string) => {
      updateDraft((current) => {
        const rarities = current.rules.talentRules?.rarities ?? [];
        if (!rarities.some((item) => item.id === id)) {
          return current;
        }

        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          rarities: rarities.filter((item) => item.id !== id),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalentRarity = useCallback(
    (id: string, updates: Partial<EditableTalentRarity>) => {
      updateDraft((current) => {
        const rarities = current.rules.talentRules?.rarities ?? [];
        const targetIndex = rarities.findIndex((item) => item.id === id);
        if (targetIndex === -1) {
          return current;
        }

        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          rarities: rarities.map((item, index) =>
            item.id === id
              ? normalizeTalentRarity(
                  {
                    ...item,
                    ...updates,
                  },
                  index,
                )
              : item,
          ),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addTalentPool = useCallback(() => {
    updateDraft((current) => {
      const pools = current.rules.talentRules?.pools ?? [];
      current.rules.talentRules = normalizeTalentRules({
        ...(current.rules.talentRules ?? {}),
        pools: [
          ...pools,
          normalizeTalentPool(
            {
              id: generateId("pool"),
              label: `抽取池 ${pools.length + 1}`,
            },
            pools.length,
          ),
        ],
      });
      return current;
    });
  }, [updateDraft]);

  const removeTalentPool = useCallback(
    (id: string) => {
      updateDraft((current) => {
        const pools = current.rules.talentRules?.pools ?? [];
        if (!pools.some((item) => item.id === id)) {
          return current;
        }

        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          pools: pools.filter((item) => item.id !== id),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalentPool = useCallback(
    (id: string, updates: Partial<EditableTalentPool>) => {
      updateDraft((current) => {
        const pools = current.rules.talentRules?.pools ?? [];
        const targetIndex = pools.findIndex((item) => item.id === id);
        if (targetIndex === -1) {
          return current;
        }

        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          pools: pools.map((item, index) =>
            item.id === id
              ? normalizeTalentPool(
                  {
                    ...item,
                    ...updates,
                  },
                  index,
                )
              : item,
          ),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addTalentPityRule = useCallback(() => {
    updateDraft((current) => {
      const talentRules = current.rules.talentRules ?? {};
      const pity = talentRules.pity ?? [];
      current.rules.talentRules = normalizeTalentRules({
        ...talentRules,
        pity: [
          ...pity,
          normalizeTalentPityRule(
            {
              afterMisses: pity.length + 1,
              guaranteeRarity: talentRules.rarities?.[0]?.id ?? "rarity_1",
            },
            pity.length,
          ),
        ],
      });
      return current;
    });
  }, [updateDraft]);

  const removeTalentPityRule = useCallback(
    (index: number) => {
      updateDraft((current) => {
        const pity = current.rules.talentRules?.pity ?? [];
        if (!pity[index]) {
          return current;
        }

        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          pity: pity.filter((_, itemIndex) => itemIndex !== index),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalentPityRule = useCallback(
    (index: number, updates: Partial<EditableTalentPityRule>) => {
      updateDraft((current) => {
        const pity = current.rules.talentRules?.pity ?? [];
        const target = pity[index];
        if (!target) {
          return current;
        }

        current.rules.talentRules = normalizeTalentRules({
          ...(current.rules.talentRules ?? {}),
          pity: pity.map((item, itemIndex) =>
            itemIndex === index
              ? normalizeTalentPityRule(
                  {
                    ...item,
                    ...updates,
                  },
                  itemIndex,
                )
              : item,
          ),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateLevelSystem = useCallback(
    (updates: Partial<LevelSystemConfig>) => {
      updateDraft((current) => {
        current.rules.levelSystem = normalizeLevelSystem(
          {
            ...(current.rules.levelSystem ?? {}),
            ...updates,
          },
          {
            primaryAttributes: current.rules.primaryAttributes,
            derivedStats: current.rules.derivedStats,
          },
        );
        return current;
      });
    },
    [updateDraft],
  );

  const updateTalent = useCallback(
    (index: number, updates: Partial<TalentConfig>) => {
      updateDraft((current) => {
        const target = current.rules.talents?.[index];
        if (!target) {
          return current;
        }

        current.rules.talents![index] = normalizeTalent(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addTalent = useCallback(() => {
    updateDraft((current) => {
      current.rules.talents = current.rules.talents ?? [];
      current.rules.talents.push({
        id: generateId("talent"),
        name: `天赋 ${current.rules.talents.length + 1}`,
        description: "",
        category: "misc",
      });
      return current;
    });
  }, [updateDraft]);

  const removeTalent = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.talents?.[index]) {
          return current;
        }

        current.rules.talents.splice(index, 1);
        return current;
      });
    },
    [updateDraft],
  );

  const updateDefaultCapacity = useCallback(
    (value: number | undefined) => {
      updateDraft((current) => {
        current.rules.inventoryRules = normalizeInventoryRules({
          ...(current.rules.inventoryRules ?? {}),
          defaultCapacity: value,
        });
        return current;
      });
    },
    [updateDraft],
  );

  const addEquipSlot = useCallback(() => {
    updateDraft((current) => {
      const equipSlotDefinitions =
        current.rules.inventoryRules?.equipSlotDefinitions ?? [];
      current.rules.inventoryRules = normalizeInventoryRules({
        ...(current.rules.inventoryRules ?? {}),
        equipSlotDefinitions: [
          ...equipSlotDefinitions,
          normalizeEquipSlotDefinition(
            {
              id: getUniqueEquipSlotId(current.rules),
              label: `槽位 ${equipSlotDefinitions.length + 1}`,
              maxCount: 1,
            },
            equipSlotDefinitions.length,
          ),
        ],
      });
      return current;
    });
  }, [updateDraft]);

  const updateEquipSlot = useCallback(
    (index: number, updates: Partial<EquipSlotDefinition>) => {
      updateDraft((current) => {
        const equipSlotDefinitions =
          current.rules.inventoryRules?.equipSlotDefinitions ?? [];
        const target = equipSlotDefinitions[index];
        if (!target) {
          return current;
        }

        current.rules.inventoryRules = normalizeInventoryRules({
          ...(current.rules.inventoryRules ?? {}),
          equipSlotDefinitions: equipSlotDefinitions.map((item, itemIndex) =>
            itemIndex === index
              ? normalizeEquipSlotDefinition(
                  {
                    ...item,
                    ...updates,
                  },
                  index,
                )
              : item,
          ),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const removeEquipSlot = useCallback(
    (index: number) => {
      updateDraft((current) => {
        const equipSlotDefinitions =
          current.rules.inventoryRules?.equipSlotDefinitions ?? [];
        if (!equipSlotDefinitions[index]) {
          return current;
        }

        current.rules.inventoryRules = normalizeInventoryRules({
          ...(current.rules.inventoryRules ?? {}),
          equipSlotDefinitions: equipSlotDefinitions.filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        });
        return current;
      });
    },
    [updateDraft],
  );

  const updateItemTemplate = useCallback(
    (index: number, updates: Partial<ItemTemplate>) => {
      updateDraft((current) => {
        current.rules.itemTemplates = current.rules.itemTemplates ?? [];
        const target = current.rules.itemTemplates[index];
        if (!target) {
          return current;
        }

        current.rules.itemTemplates[index] = normalizeItemTemplate(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addItemTemplate = useCallback(() => {
    updateDraft((current) => {
      current.rules.itemTemplates = current.rules.itemTemplates ?? [];
      current.rules.itemTemplates.push(
        normalizeItemTemplate(
          {
            id: generateId("item"),
            name: `物品 ${current.rules.itemTemplates.length + 1}`,
            description: "",
            category: "misc",
          },
          current.rules.itemTemplates.length,
        ),
      );
      return current;
    });
  }, [updateDraft]);

  const removeItemTemplate = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.itemTemplates?.[index]) {
          return current;
        }

        current.rules.itemTemplates.splice(index, 1);
        current.rules.itemTemplates = current.rules.itemTemplates.map(
          (item, itemIndex) => normalizeItemTemplate(item, itemIndex),
        );
        return current;
      });
    },
    [updateDraft],
  );

  const updateSkillTemplate = useCallback(
    (index: number, updates: Partial<SkillTemplate>) => {
      updateDraft((current) => {
        current.rules.skillTemplates = current.rules.skillTemplates ?? [];
        const target = current.rules.skillTemplates[index];
        if (!target) {
          return current;
        }

        current.rules.skillTemplates[index] = normalizeSkillTemplate(
          {
            ...target,
            ...updates,
          },
          index,
        );
        return current;
      });
    },
    [updateDraft],
  );

  const addSkillTemplate = useCallback(() => {
    updateDraft((current) => {
      current.rules.skillTemplates = current.rules.skillTemplates ?? [];
      current.rules.skillTemplates.push(
        normalizeSkillTemplate(
          {
            id: generateId("skill"),
            name: `技能 ${current.rules.skillTemplates.length + 1}`,
            description: "",
            category: "misc",
            maxLevel: 1,
            activeUsable: false,
          },
          current.rules.skillTemplates.length,
        ),
      );
      return current;
    });
  }, [updateDraft]);

  const removeSkillTemplate = useCallback(
    (index: number) => {
      updateDraft((current) => {
        if (!current.rules.skillTemplates?.[index]) {
          return current;
        }

        current.rules.skillTemplates.splice(index, 1);
        current.rules.skillTemplates = current.rules.skillTemplates.map(
          (item, itemIndex) => normalizeSkillTemplate(item, itemIndex),
        );
        return current;
      });
    },
    [updateDraft],
  );

  return {
    worlds,
    activeWorldId,
    selectedWorldId,
    selectedWorld,
    draft,
    isDirty,
    isSaving,
    isLoadingWorld,
    rawRulesEditorOpen,
    rawRulesEditorScope,
    rawRulesText,
    rawRulesError,
    mobilePage,
    validationMessages,
    selectWorld,
    setActiveWorld,
    createWorld,
    deleteWorld,
    confirmDeleteWorld,
    cancelDeleteWorld,
    saveSelectedWorld,
    resetDraft,
    resetToBuiltinDefault,
    setMobilePage,
    openRawRulesEditor,
    closeRawRulesEditor,
    setRawRulesText,
    applyRawRulesText,
    exportSelectedWorld,
    importWorldFromFile,
    updateMeta,
    updateNarrative,
    updatePrimaryAttribute,
    addPrimaryAttribute,
    removePrimaryAttribute,
    updatePointBuyRules,
    updateCheckRules,
    addDcPreset,
    updateDcPreset,
    removeDcPreset,
    addOpposedPreset,
    updateOpposedPreset,
    removeOpposedPreset,
    addDCGuidelineItem,
    updateDCGuidelineItem,
    removeDCGuidelineItem,
    updateDerivedStat,
    addDerivedStat,
    removeDerivedStat,
    updateDimension,
    addDimension,
    removeDimension,
    updateDimensionOption,
    addDimensionOption,
    removeDimensionOption,
    updateCondition,
    addCondition,
    removeCondition,
    updateTalentRules,
    addTalentRarity,
    removeTalentRarity,
    updateTalentRarity,
    addTalentPool,
    removeTalentPool,
    updateTalentPool,
    addTalentPityRule,
    removeTalentPityRule,
    updateTalentPityRule,
    updateLevelSystem,
    updateTalent,
    addTalent,
    removeTalent,
    addEquipSlot,
    updateEquipSlot,
    removeEquipSlot,
    updateDefaultCapacity,
    updateItemTemplate,
    addItemTemplate,
    removeItemTemplate,
    updateSkillTemplate,
    addSkillTemplate,
    removeSkillTemplate,
    pendingDeleteWorld,
    discardConfirm: {
      open: discardConfirm.open,
      message: discardConfirm.message,
    },
    handleConfirmDiscard,
    handleCancelDiscard,
  };
}
