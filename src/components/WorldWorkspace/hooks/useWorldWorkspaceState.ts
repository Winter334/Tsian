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

import {
  DEFAULT_WORLD_CONFIG,
  defaultWorld,
  useWorldStore,
  type WorldIndex,
} from "@/lib/world";
import type {
  CharacterDimension,
  DimensionOption,
  PointBuyRules,
  PrimaryAttributeConfig,
  TalentConfig,
  World,
  WorldConfig,
  WorldId,
  WorldMeta,
  WorldNarrativeSeed,
} from "@/lib/world/types";

export type WorldWorkspaceMobilePage = "list" | "editor" | "assistant";

type EditableWorldMeta = Pick<
  WorldMeta,
  "name" | "description" | "author" | "version" | "source"
>;

type EditableWorldSnapshot = {
  meta: EditableWorldMeta;
  rules: WorldConfig;
  narrative: WorldNarrativeSeed;
};

const EMPTY_RULES_JSON = JSON.stringify(DEFAULT_WORLD_CONFIG, null, 2);

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
  rawRulesText: string;
  rawRulesError: string | null;
  mobilePage: WorldWorkspaceMobilePage;
  validationMessages: string[];
}

export interface WorldWorkspaceActions {
  selectWorld: (id: WorldId) => void;
  setActiveWorld: (id: WorldId) => void;
  createWorld: () => Promise<World>;
  deleteWorld: (id: WorldId) => Promise<void>;
  saveSelectedWorld: () => Promise<World | null>;
  resetDraft: () => void;
  setMobilePage: (page: WorldWorkspaceMobilePage) => void;
  setRawRulesEditorOpen: (open: boolean) => void;
  setRawRulesText: (value: string) => void;
  applyRawRulesText: () => void;
  exportSelectedWorld: () => void;
  importWorldFromFile: (file: File) => Promise<World>;
  updateMeta: (updates: Partial<EditableWorldMeta>) => void;
  updateNarrative: (updates: Partial<WorldNarrativeSeed>) => void;
  updatePrimaryAttribute: (
    index: number,
    updates: Partial<PrimaryAttributeConfig>,
  ) => void;
  addPrimaryAttribute: () => void;
  removePrimaryAttribute: (index: number) => void;
  updatePointBuyRules: (updates: Partial<PointBuyRules>) => void;
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
  updateTalent: (index: number, updates: Partial<TalentConfig>) => void;
  addTalent: () => void;
  removeTalent: (index: number) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toRequiredString(value: unknown, fallback: string): string {
  return toOptionalString(value) ?? fallback;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function toNumber(value: unknown, fallback: number): number {
  return toOptionalNumber(value) ?? fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    const nextValue = toOptionalString(entry);
    if (nextValue) {
      result[key] = nextValue;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function toNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
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

function normalizePrimaryAttribute(
  value: unknown,
  index: number,
): PrimaryAttributeConfig {
  const record = isRecord(value) ? value : {};
  const fallbackKey = `attr_${index + 1}`;

  return {
    key: toRequiredString(record.key, fallbackKey),
    label: toRequiredString(record.label, `属性 ${index + 1}`),
    defaultValue: toNumber(record.defaultValue, 10),
    min: toOptionalNumber(record.min),
    max: toOptionalNumber(record.max),
    description: toOptionalString(record.description),
  };
}

function normalizeDimensionOption(
  value: unknown,
  index: number,
): DimensionOption {
  const record = isRecord(value) ? value : {};
  const rawEffects = isRecord(record.effects) ? record.effects : undefined;
  const attributeModifiers = toNumberRecord(rawEffects?.attributeModifiers);
  const grantedTalents = toStringArray(rawEffects?.grantedTalents);
  const excludedTalents = toStringArray(rawEffects?.excludedTalents);

  return {
    id: toRequiredString(record.id, `option_${index + 1}`),
    name: toRequiredString(record.name, `选项 ${index + 1}`),
    description: toRequiredString(record.description, ""),
    icon: toOptionalString(record.icon),
    defaults: toStringRecord(record.defaults),
    effects:
      attributeModifiers ||
      grantedTalents.length > 0 ||
      excludedTalents.length > 0
        ? {
            ...(attributeModifiers ? { attributeModifiers } : {}),
            ...(grantedTalents.length > 0 ? { grantedTalents } : {}),
            ...(excludedTalents.length > 0 ? { excludedTalents } : {}),
          }
        : undefined,
  };
}

function normalizeDimension(value: unknown, index: number): CharacterDimension {
  const record = isRecord(value) ? value : {};
  const options = Array.isArray(record.options)
    ? record.options.map((item, optionIndex) =>
        normalizeDimensionOption(item, optionIndex),
      )
    : [];

  return {
    id: toRequiredString(record.id, `dimension_${index + 1}`),
    label: toRequiredString(record.label, `维度 ${index + 1}`),
    description: toOptionalString(record.description),
    required: Boolean(record.required),
    order: toOptionalNumber(record.order),
    options,
  };
}

function normalizePointBuyRules(value: unknown): PointBuyRules | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    allocatableAttributes: toStringArray(value.allocatableAttributes),
    bonusPoints: toNumber(value.bonusPoints, 10),
    minPerAttribute: toOptionalNumber(value.minPerAttribute),
    maxPerAttribute: toOptionalNumber(value.maxPerAttribute),
  };
}

function normalizeTalent(value: unknown, index: number): TalentConfig {
  const record = isRecord(value) ? value : {};
  const rawPrerequisites = isRecord(record.prerequisites)
    ? record.prerequisites
    : undefined;
  const prerequisiteAttributes = toNumberRecord(rawPrerequisites?.attributes);
  const category = toOptionalString(record.category);

  return {
    id: toRequiredString(record.id, `talent_${index + 1}`),
    name: toRequiredString(record.name, `天赋 ${index + 1}`),
    description: toRequiredString(record.description, ""),
    category:
      category === "combat" ||
      category === "magic" ||
      category === "survival" ||
      category === "social" ||
      category === "misc"
        ? category
        : undefined,
    icon: toOptionalString(record.icon),
    modifiers: Array.isArray(record.modifiers)
      ? cloneValue(record.modifiers)
      : undefined,
    prerequisites: prerequisiteAttributes
      ? { attributes: prerequisiteAttributes }
      : undefined,
    exclusiveWith: toStringArray(record.exclusiveWith),
  };
}

function normalizeNarrative(value: unknown): WorldNarrativeSeed {
  const record = isRecord(value) ? value : {};

  return {
    script: toOptionalString(record.script),
    opening: toOptionalString(record.opening),
  };
}

function isWorldConfig(value: unknown): value is WorldConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 1 &&
    Array.isArray(value.primaryAttributes) &&
    Array.isArray(value.derivedStats) &&
    isRecord(value.checkRules)
  );
}

function normalizeWorldRules(
  worldId: string,
  worldName: string,
  rules: WorldConfig,
): WorldConfig {
  const pointBuyRules = normalizePointBuyRules(rules.pointBuyRules);

  return {
    ...cloneValue(DEFAULT_WORLD_CONFIG),
    ...cloneValue(rules),
    version: 1,
    worldId,
    worldName,
    primaryAttributes: Array.isArray(rules.primaryAttributes)
      ? rules.primaryAttributes.map((item, index) =>
          normalizePrimaryAttribute(item, index),
        )
      : cloneValue(DEFAULT_WORLD_CONFIG.primaryAttributes),
    derivedStats: Array.isArray(rules.derivedStats)
      ? cloneValue(rules.derivedStats)
      : cloneValue(DEFAULT_WORLD_CONFIG.derivedStats),
    checkRules: isRecord(rules.checkRules)
      ? cloneValue(rules.checkRules)
      : cloneValue(DEFAULT_WORLD_CONFIG.checkRules),
    dimensions: Array.isArray(rules.dimensions)
      ? rules.dimensions.map((item, index) => normalizeDimension(item, index))
      : [],
    pointBuyRules,
    talents: Array.isArray(rules.talents)
      ? rules.talents.map((item, index) => normalizeTalent(item, index))
      : [],
  };
}

function normalizeWorld(world: World): World {
  const metaSource = world.meta.source === "lyra" ? "lyra" : "custom";
  const metaName = toRequiredString(world.meta.name, "未命名世界");

  return {
    id: world.id,
    meta: {
      name: metaName,
      description: toOptionalString(world.meta.description),
      author: toOptionalString(world.meta.author),
      version: toRequiredString(world.meta.version, "1.0.0"),
      createdAt: toNumber(world.meta.createdAt, Date.now()),
      updatedAt: toNumber(world.meta.updatedAt, Date.now()),
      source: metaSource,
    },
    rules: normalizeWorldRules(world.id, metaName, world.rules),
    narrative: normalizeNarrative(world.narrative),
  };
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
  const [rawRulesText, setRawRulesTextState] = useState(EMPTY_RULES_JSON);
  const [rawRulesError, setRawRulesError] = useState<string | null>(null);
  const [mobilePage, setMobilePage] =
    useState<WorldWorkspaceMobilePage>("list");

  const isDirty = useMemo(() => {
    const baseSnapshot = getEditableSnapshot(selectedWorld);
    const draftSnapshot = getEditableSnapshot(draft);

    if (!baseSnapshot || !draftSnapshot) {
      return false;
    }

    return JSON.stringify(baseSnapshot) !== JSON.stringify(draftSnapshot);
  }, [draft, selectedWorld]);

  const validationMessages = useMemo(() => {
    if (!draft) {
      return [];
    }

    const messages: string[] = [];
    const attributeKeys = new Set(
      draft.rules.primaryAttributes.map((item) => item.key),
    );
    const allocatableAttributes =
      draft.rules.pointBuyRules?.allocatableAttributes ?? [];
    const invalidAllocatableKeys = allocatableAttributes.filter(
      (key) => !attributeKeys.has(key),
    );
    const emptyDimensions = (draft.rules.dimensions ?? []).filter(
      (item) => item.options.length === 0,
    );

    if (!draft.meta.name.trim()) {
      messages.push("世界名称不能为空。");
    }

    if (draft.rules.primaryAttributes.length === 0) {
      messages.push("至少需要一个主要属性。");
    }

    if (allocatableAttributes.length === 0) {
      messages.push("点数分配规则尚未配置可分配属性，角色创建将跳过属性分配。");
    }

    if (invalidAllocatableKeys.length > 0) {
      messages.push(
        `点数分配引用了不存在的属性：${invalidAllocatableKeys.join("、")}。`,
      );
    }

    if (emptyDimensions.length > 0) {
      messages.push(
        `以下维度没有可选项，将不会在创建向导中显示：${emptyDimensions
          .map((item) => item.label)
          .join("、")}。`,
      );
    }

    if ((draft.rules.talents ?? []).length === 0) {
      messages.push("当前世界没有可选天赋，角色创建流程会跳过天赋步骤。");
    }

    return messages;
  }, [draft]);

  const updateDraft = useCallback((updater: (current: World) => World) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const next = updater(cloneValue(current));
      return normalizeWorld(next);
    });
  }, []);

  const syncRawRulesFromDraft = useCallback((world: World | null) => {
    if (!world) {
      setRawRulesTextState(EMPTY_RULES_JSON);
      setRawRulesError(null);
      return;
    }

    setRawRulesTextState(JSON.stringify(normalizeWorld(world).rules, null, 2));
    setRawRulesError(null);
  }, []);

  const confirmDiscardChanges = useCallback(
    (message = "当前世界有未保存修改，继续操作会丢失这些更改。是否继续？") => {
      if (!isDirty) {
        return true;
      }

      return window.confirm(message);
    },
    [isDirty],
  );

  useEffect(() => {
    if (worlds.length === 0) {
      setSelectedWorldId(null);
      setSelectedWorld(null);
      setDraft(null);
      syncRawRulesFromDraft(null);
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
      syncRawRulesFromDraft(normalizedWorld);
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

      if (!confirmDiscardChanges()) {
        return;
      }

      setSelectedWorldId(id);
      setMobilePage("editor");
    },
    [confirmDiscardChanges, selectedWorldId],
  );

  const setActiveWorld = useCallback(
    (id: WorldId) => {
      setActiveWorldInStore(id);
    },
    [setActiveWorldInStore],
  );

  const createWorld = useCallback(async () => {
    if (!confirmDiscardChanges("新建世界会放弃当前未保存修改。是否继续？")) {
      throw new Error("已取消新建世界");
    }

    const name = getNextWorldName(worlds);
    const world = await createWorldInStore(name, "");
    setActiveWorldInStore(world.id);
    setSelectedWorldId(world.id);
    setMobilePage("editor");
    return normalizeWorld({
      ...world,
      narrative: world.narrative ?? {},
      rules: normalizeWorldRules(world.id, world.meta.name, world.rules),
    });
  }, [
    confirmDiscardChanges,
    createWorldInStore,
    setActiveWorldInStore,
    worlds,
  ]);

  const deleteWorld = useCallback(
    async (id: WorldId) => {
      const target = worlds.find((item) => item.id === id);
      const targetName = target?.name ?? "该世界";
      const confirmed = window.confirm(
        `确定删除「${targetName}」吗？此操作不可撤销。`,
      );

      if (!confirmed) {
        return;
      }

      await deleteWorldInStore(id);
    },
    [deleteWorldInStore, worlds],
  );

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
      syncRawRulesFromDraft(nextWorld);
      return nextWorld;
    } finally {
      setIsSaving(false);
    }
  }, [draft, getWorld, syncRawRulesFromDraft, updateWorldInStore]);

  const resetDraft = useCallback(() => {
    if (!selectedWorld) {
      return;
    }

    const nextWorld = normalizeWorld(selectedWorld);
    setDraft(cloneValue(nextWorld));
    setRawRulesEditorOpenState(false);
    syncRawRulesFromDraft(nextWorld);
  }, [selectedWorld, syncRawRulesFromDraft]);

  const setRawRulesEditorOpen = useCallback(
    (open: boolean) => {
      setRawRulesEditorOpenState(open);
      setRawRulesError(null);

      if (open && draft) {
        syncRawRulesFromDraft(draft);
      }
    },
    [draft, syncRawRulesFromDraft],
  );

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
      if (!isWorldConfig(parsed)) {
        throw new Error("规则 JSON 未通过基础 schema 校验");
      }

      updateDraft((current) => {
        current.rules = normalizeWorldRules(
          current.id,
          current.meta.name,
          parsed,
        );
        return current;
      });
      setRawRulesError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "原始规则解析失败";
      setRawRulesError(message);
      throw error;
    }
  }, [draft, rawRulesText, updateDraft]);

  const exportSelectedWorld = useCallback(() => {
    if (!draft) {
      return;
    }

    downloadWorld(draft);
  }, [draft]);

  const importWorldFromFile = useCallback(
    async (file: File) => {
      if (!confirmDiscardChanges("导入新世界会切换当前编辑对象，是否继续？")) {
        throw new Error("已取消导入");
      }

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
      return normalizeWorld(persisted ?? createdWorld);
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
    rawRulesText,
    rawRulesError,
    mobilePage,
    validationMessages,
    selectWorld,
    setActiveWorld,
    createWorld,
    deleteWorld,
    saveSelectedWorld,
    resetDraft,
    setMobilePage,
    setRawRulesEditorOpen,
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
    updateDimension,
    addDimension,
    removeDimension,
    updateDimensionOption,
    addDimensionOption,
    removeDimensionOption,
    updateTalent,
    addTalent,
    removeTalent,
  };
}
