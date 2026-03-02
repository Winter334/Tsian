/**
 * NPC 列表组件
 *
 * 在右侧场景栏展示当前存档的 NPC 列表：
 * - 按状态分组（在场 active / 离场 off_scene）
 * - 卡片展示：头像、姓名、等级、叙事状态摘要
 * - 点击卡片打开 NPC 详情弹窗
 * - archived / dead 状态不展示
 *
 * 数据从 Yjs 文档与 World Archive Store 只读获取
 */

import type { Easing } from "framer-motion";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { yjsManager } from "@/core/yjs";
import type { Character } from "@/domain/entities/character";
import { useCurrentSaveId, useWorldArchiveStore } from "@/modules";
import { yMapToCharacter } from "@/modules/game/repository";
import { color, colorAlpha } from "@/styles/tokens";
import { NpcDetailDialog } from "./NpcDetailDialog";

// ── 动画 ──

const easeOut: Easing = [0.0, 0.0, 0.2, 1.0];

const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.25,
      ease: easeOut,
    },
  }),
};

type TokenColorKey = Parameters<typeof color>[0];

const AVATAR_COLOR_KEYS: TokenColorKey[] = [
  "primary",
  "secondary",
  "success",
  "warning",
  "error",
];

function getAvatarColorKey(seed: string): TokenColorKey {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return AVATAR_COLOR_KEYS[hash % AVATAR_COLOR_KEYS.length] ?? "primary";
}

function getCharacterInitial(name: string): string {
  const initial = name.trim().slice(0, 1);
  return initial ? initial.toUpperCase() : "?";
}

// ── Hook: 从 Yjs 读取 NPC 角色列表 ──

/**
 * 从当前存档读取所有 NPC 角色（controlType === 'npc'）
 * 排除 archived 和 dead 状态
 */
function useNpcCharacters(): Character[] {
  const [npcs, setNpcs] = useState<Character[]>([]);
  const currentSaveId = useCurrentSaveId();

  const readNpcs = useCallback(() => {
    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) {
      setNpcs([]);
      return;
    }

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap && charactersMap.size > 0) {
      const npcChars: Character[] = [];
      charactersMap.forEach((charMap) => {
        const char = yMapToCharacter(charMap);
        if (
          char.controlType === "npc" &&
          (char.status === "active" || char.status === "off_scene")
        ) {
          npcChars.push(char);
        }
      });

      setNpcs(npcChars);
      return;
    }

    setNpcs([]);
  }, []);

  useEffect(() => {
    readNpcs();

    const currentSave = yjsManager.getCurrentSave();
    if (!currentSave) return;

    const saveHandler = () => readNpcs();
    currentSave.observe(saveHandler);

    const charactersMap = currentSave.get("characters") as
      | import("yjs").Map<import("yjs").Map<unknown>>
      | undefined;

    if (charactersMap) {
      const mapHandler = () => readNpcs();
      charactersMap.observeDeep(mapHandler);

      return () => {
        charactersMap.unobserveDeep(mapHandler);
        currentSave.unobserve(saveHandler);
      };
    }

    return () => {
      currentSave.unobserve(saveHandler);
    };
  }, [readNpcs, currentSaveId]);

  return npcs;
}

// ── NPC 列表项 ──

interface NpcCardProps {
  character: Character;
  index: number;
  isOffScene?: boolean;
  onOpenDetail: (characterId: string) => void;
}

function NpcCard({ character, index, isOffScene, onOpenDetail }: NpcCardProps) {
  const narrativeState = useWorldArchiveStore((state) => {
    return state.getEntityByGameId(character.id)?.currentState;
  });

  const level = useMemo(() => {
    const value = (character.attributes as Record<string, unknown> | undefined)
      ?.level;
    return typeof value === "number" ? value : null;
  }, [character.attributes]);

  const displayState = narrativeState?.trim() || "暂无叙事状态";
  const avatarColorKey = getAvatarColorKey(character.id);

  return (
    <motion.button
      type="button"
      custom={index}
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      onClick={() => onOpenDetail(character.id)}
      className="w-full rounded-lg px-3 py-2.5 flex items-center gap-2.5 text-left cursor-pointer"
      style={{
        background: colorAlpha("primary", isOffScene ? 0.03 : 0.05),
        border: `1px solid ${colorAlpha("primary", isOffScene ? 0.1 : 0.16)}`,
        opacity: isOffScene ? 0.78 : 1,
      }}
      whileHover={{
        y: -1,
      }}
      transition={{ duration: 0.16 }}
    >
      <span
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold"
        style={{
          background: colorAlpha(avatarColorKey, 0.2),
          border: `1px solid ${colorAlpha(avatarColorKey, 0.32)}`,
          color: color(avatarColorKey),
        }}
      >
        {getCharacterInitial(character.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold truncate"
            style={{
              color: isOffScene ? color("textSecondary") : color("textPrimary"),
            }}
          >
            {character.name}
          </span>

          {level != null && (
            <span
              className="text-xs shrink-0 px-1.5 py-0.5 rounded"
              style={{
                background: colorAlpha("secondary", 0.1),
                color: isOffScene ? color("textMuted") : color("secondary"),
              }}
            >
              Lv.{level}
            </span>
          )}
        </div>

        <p
          className="text-xs truncate mt-0.5"
          style={{
            color: narrativeState
              ? color("textMuted")
              : colorAlpha("textMuted", 0.8),
          }}
          title={displayState}
        >
          {displayState}
        </p>
      </div>

      <ChevronRight
        className="w-4 h-4 shrink-0"
        style={{ color: colorAlpha("textMuted", isOffScene ? 0.65 : 0.85) }}
      />
    </motion.button>
  );
}

// ── 分组标题 ──

interface GroupHeaderProps {
  icon: string;
  label: string;
  count: number;
}

function GroupHeader({ icon, label, count }: GroupHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm">{icon}</span>
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: color("primary") }}
      >
        {label}
      </span>
      <span
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{
          background: colorAlpha("primary", 0.1),
          color: color("textMuted"),
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── 主组件 ──

/**
 * NPC 列表
 *
 * 按状态分组展示当前存档中的 NPC，并在点击时打开详情弹窗
 */
export function NpcList() {
  const npcs = useNpcCharacters();
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { activeNpcs, offSceneNpcs } = useMemo(() => {
    const active: Character[] = [];
    const offScene: Character[] = [];

    for (const npc of npcs) {
      if (npc.status === "active") {
        active.push(npc);
      } else if (npc.status === "off_scene") {
        offScene.push(npc);
      }
    }

    return { activeNpcs: active, offSceneNpcs: offScene };
  }, [npcs]);

  const handleOpenDetail = useCallback((characterId: string) => {
    setSelectedNpcId(characterId);
    setDialogOpen(true);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedNpcId(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedNpcId) {
      return;
    }

    const selectedStillExists = npcs.some((npc) => npc.id === selectedNpcId);
    if (!selectedStillExists) {
      setDialogOpen(false);
      setSelectedNpcId(null);
    }
  }, [npcs, selectedNpcId]);

  if (npcs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-4">
        {/* 分割线 */}
        <div
          className="h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${colorAlpha(
              "primary",
              0.2,
            )}, transparent)`,
          }}
        />

        {/* 在场 NPC */}
        {activeNpcs.length > 0 && (
          <div>
            <GroupHeader icon="⬡" label="在场 NPC" count={activeNpcs.length} />
            <div className="space-y-2">
              {activeNpcs.map((npc, i) => (
                <NpcCard
                  key={npc.id}
                  character={npc}
                  index={i}
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </div>
          </div>
        )}

        {/* 离场 NPC */}
        {offSceneNpcs.length > 0 && (
          <div>
            <GroupHeader
              icon="⬡"
              label="离场 NPC"
              count={offSceneNpcs.length}
            />
            <div className="space-y-2">
              {offSceneNpcs.map((npc, i) => (
                <NpcCard
                  key={npc.id}
                  character={npc}
                  index={i}
                  isOffScene
                  onOpenDetail={handleOpenDetail}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <NpcDetailDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        characterId={selectedNpcId}
      />
    </>
  );
}
