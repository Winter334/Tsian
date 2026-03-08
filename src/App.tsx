import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import { CharacterPanelDialog } from "./components/CharacterPanel";
import { GameHUD } from "./components/GameHUD";
import { GameWizard, type WizardResult } from "./components/GameWizard";
import type { WizardContext } from "./components/GameWizard/types";
import { GameHub } from "./components/layout/GameHub";
import { LorebookWorkspace } from "./components/LorebookWorkspace";
import { RoomInfoDialog } from "./components/Multiplayer";
import { MultiplayerSaveDialog } from "./components/MultiplayerSaveDialog";
import { Onboarding } from "./components/Onboarding";
import { PresetWorkspace } from "./components/PresetWorkspace";
import { SaveManagerDialog } from "./components/SaveManager";
import { SettingsDialog } from "./components/Settings";
import { SplashScreen } from "./components/SplashScreen";
import { TitleScreen } from "./components/TitleScreen";
import { ToastProvider, useToast } from "./components/ui";
import { WorldWorkspace } from "./components/WorldWorkspace";
import { StorageWarningBanner, yjsManager } from "./core/yjs";
import type { SaveSlotInfo } from "./core/yjs/types";
import { RoomCommands } from "./domain/commands/room";
import { SaveCommands } from "./domain/commands/save";
import type { CharacterCreationData } from "./domain/entities/character";
import { MemoryEvents } from "./domain/events";
import type {
  CompressionFailedPayload,
  CompressionSkippedPayload,
} from "./domain/events/memory";
import { RoomEvents } from "./domain/events/room";
import { useCommand, useEvent } from "./hooks";
import { savePortrait } from "./lib/portrait/storage";
import { usePresetStore } from "./lib/prompt";
import { getLastDisplayName, getOrCreateUserId } from "./lib/user-identity";
import { useWorldStore } from "./lib/world";
import { getRuntimeWorldConfig } from "./lib/world/resolve-config";
import {
  CheckpointPanel,
  GameView,
  MemoryManagerDialog,
  useCurrentSaveId,
  useSaveSlots,
} from "./modules";
import { selectIsOnline, useSessionStore } from "./stores";
import { useSettingsStore } from "./stores/settings";
import {
  animation,
  colorAlpha,
  glassmorphism,
  glow,
  gradients,
  gradientText,
} from "./styles/tokens";
// 通过顶层模块入口导入，确保松耦合
import { ArchiveManagerDialog } from "./components/ArchiveManager";

type AppState = "splash" | "onboarding" | "title" | "wizard" | "hub" | "game";
type HubGameTransitionState = "idle" | "hub-to-game" | "game-to-hub";
type HubGameTransitionPhase = "idle" | "out" | "in";
type ActiveHubGameTransition = Exclude<HubGameTransitionState, "idle">;
type ActiveHubGameTransitionPhase = Exclude<HubGameTransitionPhase, "idle">;

const HUB_GAME_TRANSITION_EASE = [0.22, 1, 0.36, 1] as const;
const RETURN_TO_TITLE_THROTTLE_MS = 800;
const HUB_GAME_EXIT_HANDOFF_RATIO = 0.82;
const HUB_GAME_EXIT_DURATION_MS =
  animation.duration.slow * 1000 * HUB_GAME_EXIT_HANDOFF_RATIO;
const HUB_GAME_EXIT_REDUCED_MOTION_MS = 170;
const HUB_GAME_ENTER_DURATION_MS = animation.duration.normal * 1000;
const HUB_GAME_ENTER_REDUCED_MOTION_MS = 130;
const TRANSITION_CARD_CLIP_PATH =
  "polygon(0 12%, 12% 0, 88% 0, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0 88%)";
const TRANSITION_CARD_CLIP_STYLE = {
  clipPath: TRANSITION_CARD_CLIP_PATH,
  WebkitClipPath: TRANSITION_CARD_CLIP_PATH,
} as const;

interface HubGameTransitionShellProps {
  direction: ActiveHubGameTransition;
  phase: ActiveHubGameTransitionPhase;
}

function HubGameTransitionShell({
  direction,
  phase,
}: HubGameTransitionShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const isHubToGame = direction === "hub-to-game";
  const phaseDuration = shouldReduceMotion
    ? 0.17
    : phase === "out"
      ? animation.duration.slow
      : animation.duration.normal;
  const scrimOpacity = shouldReduceMotion
    ? phase === "out"
      ? 0.3
      : 0.16
    : isHubToGame
      ? phase === "out"
        ? 0.28
        : 0.78
      : phase === "out"
        ? 0.8
        : 0.22;
  const shellInitial = shouldReduceMotion
    ? {
        opacity: 0,
        scale: isHubToGame ? 0.98 : 1.06,
      }
    : isHubToGame
      ? {
          rotateY: 0,
          rotateX: 0,
          scale: 1,
          y: 0,
          opacity: 1,
          filter: "blur(0px)",
        }
      : {
          rotateY: 180,
          rotateX: -8,
          scale: 1.72,
          y: -44,
          opacity: 0.04,
          filter: "blur(16px)",
        };
  const shellAnimate = shouldReduceMotion
    ? phase === "out"
      ? {
          opacity: 1,
          scale: isHubToGame ? 1.06 : 1.015,
        }
      : {
          opacity: 0,
          scale: isHubToGame ? 1.12 : 1,
        }
    : isHubToGame
      ? phase === "out"
        ? {
            rotateY: 118,
            rotateX: 10,
            scale: 1.32,
            y: -26,
            opacity: 1,
            filter: "blur(0px)",
          }
        : {
            rotateY: 180,
            rotateX: 16,
            scale: 1.84,
            y: -48,
            opacity: 0,
            filter: "blur(12px)",
          }
      : phase === "out"
        ? {
            rotateY: 72,
            rotateX: -12,
            scale: 1.34,
            y: -26,
            opacity: 1,
            filter: "blur(0px)",
          }
        : {
            rotateY: 0,
            rotateX: 0,
            scale: 1,
            y: 0,
            opacity: 0,
            filter: "blur(7px)",
          };

  const shellTransition = {
    duration: phaseDuration,
    ease: HUB_GAME_TRANSITION_EASE,
    ...(shouldReduceMotion
      ? {}
      : {
          rotateY: {
            duration: phaseDuration,
            ease: [0.32, 0.02, 0.2, 1] as const,
          },
          rotateX: {
            duration: phaseDuration,
            ease: HUB_GAME_TRANSITION_EASE,
          },
          scale: {
            duration: phaseDuration,
            ease: HUB_GAME_TRANSITION_EASE,
          },
          opacity: {
            duration: phaseDuration * (phase === "out" ? 1 : 0.82),
            ease: [0.32, 0, 0.2, 1] as const,
          },
        }),
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-45 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{ opacity: scrimOpacity }}
        transition={{
          duration: phaseDuration,
          ease: HUB_GAME_TRANSITION_EASE,
        }}
        style={{
          background: `radial-gradient(circle at 50% 50%, ${colorAlpha(
            "bgBase",
            phase === "out" ? 0.04 : 0.02,
          )} 0%, ${colorAlpha("bgBase", phase === "out" ? 0.16 : 0.2)} 18%, ${colorAlpha("bgBase", phase === "out" ? 0.74 : 0.92)} 72%), linear-gradient(180deg, ${colorAlpha("bgBase", phase === "out" ? 0.32 : 0.38)} 0%, ${colorAlpha("bgBase", phase === "out" ? 0.64 : 0.82)} 100%)`,
        }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          perspective: shouldReduceMotion ? undefined : "1500px",
        }}
      >
        <motion.div
          className="absolute h-40 w-40 blur-3xl md:h-56 md:w-56"
          initial={false}
          animate={{
            opacity: phase === "out" ? 0.84 : 0.28,
            scale: phase === "out" ? 1.18 : 1.56,
          }}
          transition={{
            duration: phaseDuration,
            ease: HUB_GAME_TRANSITION_EASE,
          }}
          style={{
            ...TRANSITION_CARD_CLIP_STYLE,
            background: `radial-gradient(circle at 50% 50%, ${colorAlpha(
              "primary",
              0.52,
            )} 0%, ${colorAlpha("secondary", 0.24)} 36%, transparent 74%)`,
          }}
        />

        <motion.div
          className="relative h-40 w-40 md:h-56 md:w-56"
          initial={shellInitial}
          animate={shellAnimate}
          transition={shellTransition}
          style={{
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
          }}
        >
          <div
            className="absolute -inset-4 blur-2xl md:-inset-6"
            style={{
              ...TRANSITION_CARD_CLIP_STYLE,
              background: `radial-gradient(circle at 50% 50%, ${colorAlpha(
                "primary",
                0.3,
              )} 0%, ${colorAlpha("secondary", 0.12)} 34%, transparent 76%)`,
            }}
          />

          <div
            className="absolute inset-0 overflow-hidden rounded-[1.4rem]"
            style={{
              ...glassmorphism(0.54),
              ...TRANSITION_CARD_CLIP_STYLE,
              background: `linear-gradient(168deg, ${colorAlpha(
                "bgCard",
                0.72,
              )} 0%, ${colorAlpha("bgElevated", 0.58)} 42%, ${colorAlpha(
                "bgBase",
                0.66,
              )} 100%)`,
              border: `1px solid ${colorAlpha("primary", 0.22)}`,
              boxShadow: `0 20px 44px ${colorAlpha("bgBase", 0.28)}, ${glow(
                "primary",
                "lg",
                0.18,
              )}, inset 0 0 0 1px ${colorAlpha("textPrimary", 0.05)}`,
              backdropFilter: "blur(18px) saturate(135%)",
              WebkitBackdropFilter: "blur(18px) saturate(135%)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "translateZ(2px)",
            }}
          >
            <div
              className="absolute inset-px rounded-[calc(1.4rem-1px)]"
              style={{
                ...TRANSITION_CARD_CLIP_STYLE,
                background: `radial-gradient(circle at 50% 34%, ${colorAlpha(
                  "primary",
                  0.22,
                )} 0%, ${colorAlpha("secondary", 0.12)} 18%, transparent 56%), linear-gradient(180deg, ${colorAlpha("textPrimary", 0.08)} 0%, transparent 28%, ${colorAlpha("primary", 0.06)} 100%)`,
                boxShadow: `inset 0 0 0 1px ${colorAlpha("textPrimary", 0.04)}`,
              }}
            />
            <div
              className="absolute inset-[8%] rounded-[1.15rem]"
              style={{
                ...TRANSITION_CARD_CLIP_STYLE,
                background: `linear-gradient(138deg, transparent 4%, ${colorAlpha(
                  "primary",
                  0.06,
                )} 38%, transparent 62%), repeating-linear-gradient(180deg, transparent 0px, transparent 13px, ${colorAlpha(
                  "primary",
                  0.08,
                )} 13.5px, transparent 14px), repeating-linear-gradient(90deg, transparent 0px, transparent 18px, ${colorAlpha(
                  "secondary",
                  0.06,
                )} 18.5px, transparent 19px)`,
                boxShadow: `inset 0 0 18px ${colorAlpha("primary", 0.08)}`,
                mixBlendMode: "screen",
              }}
            />
            <div
              className="absolute inset-[6.5%] rounded-[1.1rem]"
              style={{
                ...TRANSITION_CARD_CLIP_STYLE,
                border: `1px solid ${colorAlpha("primary", 0.3)}`,
                boxShadow: `inset 0 0 0 1px ${colorAlpha(
                  "textPrimary",
                  0.05,
                )}, inset 0 0 18px ${colorAlpha("primary", 0.08)}`,
              }}
            />
            <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center md:px-6">
              <span
                className="text-[10px] md:text-xs uppercase tracking-[0.24em]"
                style={{ color: colorAlpha("textSecondary", 0.68) }}
              >
                Adventure Gate
              </span>
              <strong
                className="mt-1 text-xl font-semibold md:text-3xl"
                style={{
                  ...gradientText(gradients.text()),
                  textShadow: glow("primary", "sm", 0.18),
                }}
              >
                继续冒险
              </strong>
              <span
                className="mt-3 text-[10px] md:text-xs uppercase tracking-[0.22em]"
                style={{ color: colorAlpha("textPrimary", 0.76) }}
              >
                INSPECTION SURFACE
              </span>
            </div>
            <div
              className="absolute inset-x-7 top-5 h-px md:top-6"
              style={{
                background: `linear-gradient(90deg, transparent, ${colorAlpha(
                  "secondary",
                  0.22,
                )} 18%, ${colorAlpha("primary", 0.56)} 50%, ${colorAlpha(
                  "secondary",
                  0.22,
                )} 82%, transparent)`,
              }}
            />
            <div
              className="absolute inset-x-6 bottom-4 h-px md:bottom-5"
              style={{
                background: `linear-gradient(90deg, transparent, ${colorAlpha(
                  "primary",
                  0.56,
                )}, ${colorAlpha("secondary", 0.42)}, transparent)`,
                boxShadow: glow("primary", "sm", 0.14),
              }}
            />
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-[1.4rem]"
            style={{
              ...glassmorphism(0.62),
              ...TRANSITION_CARD_CLIP_STYLE,
              background: `linear-gradient(148deg, ${colorAlpha(
                "bgElevated",
                0.82,
              )} 0%, ${colorAlpha("bgCard", 0.72)} 42%, ${colorAlpha(
                "bgBase",
                0.82,
              )} 100%)`,
              border: `1px solid ${colorAlpha("secondary", 0.18)}`,
              boxShadow: `0 18px 40px ${colorAlpha("bgBase", 0.24)}, ${glow(
                "primary",
                "md",
                0.16,
              )}, inset 0 0 0 1px ${colorAlpha("textPrimary", 0.04)}`,
              backdropFilter: "blur(18px) saturate(130%)",
              WebkitBackdropFilter: "blur(18px) saturate(130%)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(2px)",
            }}
          >
            <div
              className="absolute inset-[8%] rounded-[1.1rem]"
              style={{
                ...TRANSITION_CARD_CLIP_STYLE,
                background: `radial-gradient(circle at 50% 46%, ${colorAlpha(
                  "primary",
                  0.18,
                )} 0%, ${colorAlpha("secondary", 0.12)} 24%, transparent 58%), repeating-linear-gradient(135deg, transparent 0px, transparent 14px, ${colorAlpha(
                  "primary",
                  0.05,
                )} 14.5px, transparent 15px), linear-gradient(180deg, ${colorAlpha(
                  "textPrimary",
                  0.05,
                )} 0%, transparent 24%, ${colorAlpha("primary", 0.06)} 100%)`,
                boxShadow: `inset 0 0 18px ${colorAlpha("primary", 0.1)}`,
              }}
            />
            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
              <div
                className="h-13 w-13 rounded-full md:h-18 md:w-18"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${colorAlpha(
                    "textPrimary",
                    0.86,
                  )} 0%, ${colorAlpha("secondary", 0.34)} 18%, ${colorAlpha(
                    "primary",
                    0.12,
                  )} 48%, transparent 76%)`,
                  boxShadow: `${glow("primary", "md", 0.22)}, inset 0 0 16px ${colorAlpha(
                    "textPrimary",
                    0.14,
                  )}`,
                }}
              />
              <div
                className="mt-5 h-px w-16 md:w-24"
                style={{
                  background: `linear-gradient(90deg, transparent, ${colorAlpha(
                    "secondary",
                    0.44,
                  )}, transparent)`,
                }}
              />
              <span
                className="mt-3 text-[10px] md:text-xs uppercase tracking-[0.28em]"
                style={{ color: colorAlpha("textPrimary", 0.74) }}
              >
                Transition Shell
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * 房间事件监听器组件
 *
 * 必须在 ToastProvider 内部使用，监听房间解散事件
 */
function RoomEventListener({
  appState,
  onReturnToTitle,
}: {
  appState: AppState;
  onReturnToTitle: () => void;
}) {
  const { toast } = useToast();
  const previousRoomRef = useRef<boolean>(false);
  const hadOnlineContextRef = useRef<boolean>(false);
  const lastReturnAtRef = useRef<number>(0);

  const returnToTitleWithThrottle = useCallback(() => {
    const now = Date.now();
    if (now - lastReturnAtRef.current < RETURN_TO_TITLE_THROTTLE_MS) {
      return;
    }
    lastReturnAtRef.current = now;
    onReturnToTitle();
  }, [onReturnToTitle]);

  // 监听联机房间状态 - 当在 wizard/hub/game 状态下房间突然变为 null 时返回标题界面
  const roomId = useSessionStore((s) => s.roomId);
  const isOnline = useSessionStore(selectIsOnline);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);

  // 监听房间解散事件（使用 useEvent hook 符合架构规范）
  useEvent(RoomEvents.ROOM_DELETED, () => {
    // 显示提示
    toast("info", "房间已解散", "房主解散了房间");

    // 返回标题界面
    returnToTitleWithThrottle();
  });

  // 监听记忆压缩跳过提示（预设缺失等）
  useEvent<CompressionSkippedPayload>(
    MemoryEvents.COMPRESSION_SKIPPED,
    (event) => {
      toast("warning", "记忆压缩已跳过", event.payload.message);
    },
  );

  // 监听记忆压缩失败提示（AI 调用失败、写入失败等）
  useEvent<CompressionFailedPayload>(
    MemoryEvents.COMPRESSION_FAILED,
    (event) => {
      toast("error", "记忆压缩失败", event.payload.message);
    },
  );

  // 监听房间状态变化
  useEffect(() => {
    // 只在 wizard、hub 或 game 状态下检查
    if (appState !== "wizard" && appState !== "hub" && appState !== "game") {
      previousRoomRef.current = false;
      hadOnlineContextRef.current = false;
      return;
    }

    const hasRoomContext = !!roomId;
    const isConnectionUnavailable =
      connectionStatus === "disconnected" || connectionStatus === "error";

    // 只要出现过房间或联机态，就记录联机上下文（用于时序兜底）
    if (hasRoomContext || isOnline) {
      hadOnlineContextRef.current = true;
    }

    // 原主流程：如果之前有房间（联机模式），现在没有了，说明房间被解散或断开
    if (previousRoomRef.current && !roomId && !isOnline) {
      returnToTitleWithThrottle();
    }

    // 兜底分支：断连已明确不可用，且已无房间上下文，收口回标题
    if (
      hadOnlineContextRef.current &&
      !hasRoomContext &&
      isConnectionUnavailable
    ) {
      returnToTitleWithThrottle();
      hadOnlineContextRef.current = false;
    }

    // 更新追踪状态（保持既有主判定）
    previousRoomRef.current = hasRoomContext && isOnline;
  }, [roomId, isOnline, connectionStatus, appState, returnToTitleWithThrottle]);

  return null;
}

function AppContent() {
  const [appState, setAppState] = useState<AppState>("splash");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveManagerOpen, setSaveManagerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [multiplayerDialogOpen, setMultiplayerDialogOpen] = useState(false);
  const [presetWorkspaceOpen, setPresetWorkspaceOpen] = useState(false);
  const [lorebookWorkspaceOpen, setLorebookWorkspaceOpen] = useState(false);
  const [worldWorkspaceOpen, setWorldWorkspaceOpen] = useState(false);
  const [characterPanelOpen, setCharacterPanelOpen] = useState(false);
  const [memoryManagerOpen, setMemoryManagerOpen] = useState(false);
  const [checkpointPanelOpen, setCheckpointPanelOpen] = useState(false);
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [archiveManagerOpen, setArchiveManagerOpen] = useState(false);
  const [selectedMultiplayerSave, setSelectedMultiplayerSave] =
    useState<SaveSlotInfo | null>(null);
  const [hubGameTransition, setHubGameTransition] =
    useState<HubGameTransitionState>("idle");
  const [hubGameTransitionPhase, setHubGameTransitionPhase] =
    useState<HubGameTransitionPhase>("idle");
  const hubGameTransitionTimerRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // GameWizard 初始状态（用于"开启新聚会"场景）
  const [wizardInitialStep, setWizardInitialStep] = useState<
    string | undefined
  >(undefined);
  const [wizardInitialContext, setWizardInitialContext] = useState<
    Partial<WizardContext> | undefined
  >(undefined);

  const { hasCompletedOnboarding, loadSettings } = useSettingsStore();

  // 获取存档槽位信息（从 Yjs）
  const saves = useSaveSlots();
  const currentSaveId = useCurrentSaveId();

  // 检查是否有存档槽位
  const hasSaveData = saves.length > 0;
  const hubGameExitDurationMs = shouldReduceMotion
    ? HUB_GAME_EXIT_REDUCED_MOTION_MS
    : HUB_GAME_EXIT_DURATION_MS;
  const hubGameEnterDurationMs = shouldReduceMotion
    ? HUB_GAME_ENTER_REDUCED_MOTION_MS
    : HUB_GAME_ENTER_DURATION_MS;

  const clearHubGameTransitionTimer = useCallback(() => {
    if (hubGameTransitionTimerRef.current !== null) {
      window.clearTimeout(hubGameTransitionTimerRef.current);
      hubGameTransitionTimerRef.current = null;
    }
  }, []);

  const setHubGameTransitionTimer = useCallback(
    (callback: () => void, delayMs: number) => {
      clearHubGameTransitionTimer();
      hubGameTransitionTimerRef.current = window.setTimeout(() => {
        hubGameTransitionTimerRef.current = null;
        callback();
      }, delayMs);
    },
    [clearHubGameTransitionTimer],
  );

  const resetHubGameTransition = useCallback(() => {
    clearHubGameTransitionTimer();
    setHubGameTransition("idle");
    setHubGameTransitionPhase("idle");
  }, [clearHubGameTransitionTimer]);

  const runHubGameTransition = useCallback(
    (
      direction: Exclude<HubGameTransitionState, "idle">,
      nextState: Extract<AppState, "hub" | "game">,
    ) => {
      setHubGameTransition(direction);
      setHubGameTransitionPhase("out");
      setHubGameTransitionTimer(() => {
        setAppState(nextState);
        setHubGameTransitionPhase("in");
        setHubGameTransitionTimer(() => {
          setHubGameTransition("idle");
          setHubGameTransitionPhase("idle");
        }, hubGameEnterDurationMs);
      }, hubGameExitDurationMs);
    },
    [hubGameEnterDurationMs, hubGameExitDurationMs, setHubGameTransitionTimer],
  );

  useEffect(() => {
    return () => {
      clearHubGameTransitionTimer();
    };
  }, [clearHubGameTransitionTimer]);

  // 获取最近的存档槽位
  const getLatestSave = () => {
    if (saves.length === 0) return null;
    return saves[0]; // 已按 updatedAt 倒序排序
  };

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 监听预设错误
  const { error: showErrorToast } = useToast();
  const presetError = usePresetStore((s) => s.error);
  const worldError = useWorldStore((s) => s.error);

  useEffect(() => {
    if (presetError) {
      showErrorToast("预设错误", presetError);
      // 清除错误状态
      usePresetStore.getState().clearError();
    }
  }, [presetError, showErrorToast]);

  useEffect(() => {
    if (worldError) {
      showErrorToast("世界错误", worldError);
      useWorldStore.getState().clearError();
    }
  }, [showErrorToast, worldError]);

  // 返回标题界面的回调
  const handleReturnToTitle = () => {
    resetHubGameTransition();
    setRoomInfoOpen(false);
    setAppState("title");
  };

  // 开屏动画完成后检查是否需要引导
  const handleSplashComplete = () => {
    if (!hasCompletedOnboarding) {
      setAppState("onboarding");
    } else {
      setAppState("title");
    }
  };

  // 引导完成
  const handleOnboardingComplete = () => {
    setAppState("title");
  };

  // 通过 CommandBus 发送命令，符合架构规范
  const dispatch = useCommand();

  // 当前联机会话状态（用于返回标题前的离房收口）
  const roomId = useSessionStore((s) => s.roomId);
  const isOnline = useSessionStore(selectIsOnline);

  // 开始新游戏 - 打开游戏向导
  const handleStart = () => {
    // 重置向导初始状态
    setWizardInitialStep(undefined);
    setWizardInitialContext(undefined);
    setWizardOpen(true);
    setAppState("wizard");
  };

  // 向导完成
  const handleWizardComplete = async (result: WizardResult) => {
    setWizardOpen(false);

    if (result.mode === "solo") {
      if (!result.worldId) {
        showErrorToast("创建存档失败", "未选择世界，无法创建新存档");
        resetHubGameTransition();
        setAppState("title");
        return;
      }
      // 单人模式：创建新存档
      // 注意：房间状态会在 SAVE_CREATED 事件触发后由 Room 模块自动重置
      const initialCharacter: CharacterCreationData | undefined =
        result.characterName
          ? {
              name: result.characterName,
              description: result.characterDescription,
              personality: result.characterPersonality,
              appearance: result.characterAppearance,
              age: result.characterAge,
              gender: result.characterGender,
              // Phase 2 角色创建字段
              dimensionSelections: result.dimensionSelections,
              talentIds: result.talentIds,
              attributes: result.attributes,
            }
          : undefined;

      const saveResult = await dispatch({
        type: SaveCommands.CREATE_SAVE,
        payload: {
          name: `存档 ${saves.length + 1}`,
          worldId: result.worldId,
          // 传入角色数据，存入 Yjs 存档的 characters 数组
          initialCharacter,
        },
      });

      if (saveResult.success) {
        if (result.portraitFile) {
          const saveId =
            (typeof saveResult.data === "string" ? saveResult.data : null) ??
            yjsManager.getCurrentSaveId();

          let characterId = result.characterId;

          if (!characterId) {
            const currentSave = yjsManager.getCurrentSave();
            const charactersMap = currentSave?.get("characters") as
              | Y.Map<unknown>
              | undefined;
            const firstCharacterId = charactersMap?.keys().next().value;
            if (typeof firstCharacterId === "string") {
              characterId = firstCharacterId;
            }
          }

          if (saveId && characterId) {
            try {
              await savePortrait(saveId, characterId, result.portraitFile);
            } catch {
              // 静默失败：肖像保存失败不影响流程
            }
          }
        }

        resetHubGameTransition();
        setAppState("hub");
      } else {
        resetHubGameTransition();
        setAppState("title");
      }
    } else {
      if (result.mode === "create-room" && !result.worldId) {
        showErrorToast("创建房间失败", "未选择世界，无法创建房间");
        resetHubGameTransition();
        setAppState("title");
        return;
      }

      // 联机模式：先进入 Hub（房间已创建/加入）
      resetHubGameTransition();
      setAppState("hub");
    }
  };

  // 向导关闭（取消）
  const handleWizardClose = () => {
    setWizardOpen(false);
    resetHubGameTransition();
    setAppState("title");
  };

  /**
   * 加载单人存档并进入 Hub
   */
  const loadSoloSave = async (saveId: string): Promise<boolean> => {
    const loadResult = await dispatch({
      type: SaveCommands.LOAD_SAVE,
      payload: { saveId },
    });

    if (loadResult.success) {
      // 注意：房间状态会在 SAVE_LOADED 事件触发后由 Room 模块自动重置
      resetHubGameTransition();
      setAppState("hub");
      return true;
    } else {
      return false;
    }
  };

  /**
   * 处理联机存档 - 弹出选择对话框
   */
  const handleMultiplayerSave = (save: SaveSlotInfo) => {
    setSelectedMultiplayerSave(save);
    setMultiplayerDialogOpen(true);
  };

  /**
   * 开启新聚会 - 使用联机存档创建新房间
   */
  const handleStartNewParty = useCallback(
    async (save: SaveSlotInfo) => {
      // 1. 加载存档
      const loadResult = await dispatch({
        type: SaveCommands.LOAD_SAVE,
        payload: { saveId: save.id },
      });

      if (!loadResult.success) {
        throw new Error(loadResult.error || "加载存档失败");
      }

      // 2. 创建新房间（使用存档中保存的配置）
      const displayName = getLastDisplayName() || "玩家";

      // 从存档中读取上次的房间配置，如果没有则使用默认值
      const maxPlayers = save.maxPlayers ?? 4;
      const turnDuration = save.turnDuration ?? 5 * 60 * 1000; // 默认5分钟

      const createResult = await dispatch({
        type: RoomCommands.CREATE_ROOM,
        payload: {
          name: save.name,
          hostUserId: getOrCreateUserId(),
          hostDisplayName: displayName,
          maxPlayers,
          turnDuration,
          // 从现有存档创建房间（复用存档数据）
          fromSaveId: save.id,
        },
      });

      if (!createResult.success) {
        throw new Error(createResult.error || "创建房间失败");
      }

      const roomData = createResult.data as { roomId: string; code: string };

      // 3. 设置向导初始状态，直接进入等待大厅
      const saveWorldConfig = getRuntimeWorldConfig();
      setWizardInitialStep("waiting-lobby");
      setWizardInitialContext({
        mode: "create-room",
        roomId: roomData.roomId,
        roomCode: roomData.code,
        worldId: saveWorldConfig.worldId,
        worldConfig: saveWorldConfig,
        // 传递存档中的成员列表，用于成员到齐检查
        expectedMembers: save.members,
      });

      // 4. 打开向导
      setWizardOpen(true);
      setAppState("wizard");
    },
    [dispatch],
  );

  // 继续游戏 - 使用当前存档或加载最近的存档
  const handleContinue = async () => {
    // 获取要加载的存档
    let targetSave: SaveSlotInfo | null = null;

    if (currentSaveId) {
      // 如果已经有当前存档，找到它
      targetSave = saves.find((s) => s.id === currentSaveId) || null;
    } else {
      // 如果没有当前存档，使用最近的存档
      targetSave = getLatestSave();
    }

    if (!targetSave) return;

    // 检查存档类型
    if (targetSave.type === "multiplayer") {
      // 联机存档：弹出选择对话框
      handleMultiplayerSave(targetSave);
    } else {
      // 单人存档：直接加载
      await loadSoloSave(targetSave.id);
    }
  };

  // 打开设置
  const handleSettings = () => {
    setSettingsOpen(true);
  };

  // 打开存档管理
  const handleSaveManager = () => {
    setSaveManagerOpen(true);
  };

  // 打开预设工作区
  const handleOpenPresetWorkspace = () => {
    setPresetWorkspaceOpen(true);
  };

  // 打开世界书工作区
  const handleOpenLorebookWorkspace = () => {
    setLorebookWorkspaceOpen(true);
  };

  // 打开世界工作台
  const handleOpenWorldWorkspace = () => {
    setWorldWorkspaceOpen(true);
  };

  // 打开角色面板
  const handleOpenCharacterPanel = () => {
    setCharacterPanelOpen(true);
  };

  // 从 Hub 进入游戏
  const handleEnterGame = () => {
    if (appState !== "hub" || hubGameTransition !== "idle") {
      return;
    }

    runHubGameTransition("hub-to-game", "game");
  };

  // 从 Game 返回 Hub
  const handleReturnToHub = () => {
    if (appState !== "game" || hubGameTransition !== "idle") {
      return;
    }

    setRoomInfoOpen(false);
    runHubGameTransition("game-to-hub", "hub");
  };

  const handleOpenMemory = () => {
    setMemoryManagerOpen(true);
  };

  const handleOpenCheckpoint = () => {
    setCheckpointPanelOpen(true);
  };

  const handleOpenRoomInfo = () => {
    setRoomInfoOpen(true);
  };

  const handleOpenWorldArchive = () => {
    setArchiveManagerOpen(true);
  };

  // 从存档管理加载存档后进入 Hub
  const handleLoadSave = () => {
    resetHubGameTransition();
    setAppState("hub");
  };

  // 返回标题画面（先尝试离房收口，再切回标题）
  const handleBackToTitle = async () => {
    try {
      // 仅在联机且存在房间时执行离房；无房间时直接通过（幂等）
      if (isOnline && roomId) {
        await dispatch({
          type: RoomCommands.LEAVE_ROOM,
          payload: {
            roomId,
            userId: getOrCreateUserId(),
          },
        });
      }
    } catch {
      // 离房失败不阻塞回标题
    } finally {
      resetHubGameTransition();
      setRoomInfoOpen(false);
      setAppState("title");
    }
  };

  const isHubGameTransitioning = hubGameTransitionPhase !== "idle";
  const activeHubGameTransition: {
    direction: ActiveHubGameTransition;
    phase: ActiveHubGameTransitionPhase;
  } | null =
    hubGameTransition === "idle" || hubGameTransitionPhase === "idle"
      ? null
      : {
          direction: hubGameTransition,
          phase: hubGameTransitionPhase,
        };
  const showHubLayer = appState === "hub";
  const showGameLayer = appState === "game";

  return (
    <>
      {/* 房间事件监听器 */}
      <RoomEventListener
        appState={appState}
        onReturnToTitle={handleReturnToTitle}
      />

      <div className="dark">
        {/* 存储空间警告横幅 */}
        <StorageWarningBanner dismissible />

        <AnimatePresence mode="wait">
          {/* 开屏动画 */}
          {appState === "splash" && (
            <SplashScreen key="splash" onComplete={handleSplashComplete} />
          )}

          {/* 首次引导 */}
          {appState === "onboarding" && (
            <Onboarding
              key="onboarding"
              onComplete={handleOnboardingComplete}
            />
          )}
        </AnimatePresence>

        {/* 标题画面 */}
        {appState === "title" && (
          <TitleScreen
            onStart={handleStart}
            onContinue={handleContinue}
            onSettings={handleSettings}
            onSaveManager={handleSaveManager}
            hasSaveData={hasSaveData}
          />
        )}

        {/* 游戏开始向导 */}
        {appState === "wizard" && (
          <GameWizard
            open={wizardOpen}
            onClose={handleWizardClose}
            onComplete={handleWizardComplete}
            initialStep={wizardInitialStep}
            initialContext={wizardInitialContext}
          />
        )}

        {/* Hub / Game 视图（源层退出 → 目标层进入） */}
        {(appState === "hub" ||
          appState === "game" ||
          isHubGameTransitioning) && (
          <div className="relative h-dvh overflow-hidden">
            {showHubLayer && (
              <GameHub
                onEnterGame={handleEnterGame}
                onBackToTitle={handleBackToTitle}
                onSettings={handleSettings}
                onSaveManager={handleSaveManager}
                onPresetWorkspace={handleOpenPresetWorkspace}
                onLorebookWorkspace={handleOpenLorebookWorkspace}
                transitionState={hubGameTransition}
                transitionPhase={hubGameTransitionPhase}
              />
            )}

            {showGameLayer && (
              <GameHUD
                onReturnToHub={handleReturnToHub}
                onOpenCharacterPanel={handleOpenCharacterPanel}
                onOpenArchiveManager={handleOpenWorldArchive}
                onOpenCheckpoint={handleOpenCheckpoint}
                onOpenMemory={handleOpenMemory}
                onOpenRoomInfo={handleOpenRoomInfo}
                transitionState={hubGameTransition}
                transitionPhase={hubGameTransitionPhase}
              >
                <GameView className="h-full" />
              </GameHUD>
            )}

            {activeHubGameTransition && (
              <HubGameTransitionShell
                direction={activeHubGameTransition.direction}
                phase={activeHubGameTransition.phase}
              />
            )}
          </div>
        )}

        {/* 设置弹窗 */}
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onOpenPresetWorkspace={handleOpenPresetWorkspace}
          onOpenLorebookWorkspace={handleOpenLorebookWorkspace}
          onOpenWorldWorkspace={handleOpenWorldWorkspace}
        />

        {/* 预设工作区 */}
        <PresetWorkspace
          open={presetWorkspaceOpen}
          onOpenChange={setPresetWorkspaceOpen}
        />

        {/* 世界书工作区 */}
        <LorebookWorkspace
          open={lorebookWorkspaceOpen}
          onOpenChange={setLorebookWorkspaceOpen}
        />

        {/* 世界工作台 */}
        <WorldWorkspace
          open={worldWorkspaceOpen}
          onOpenChange={setWorldWorkspaceOpen}
        />

        {/* 存档管理弹窗 */}
        <SaveManagerDialog
          open={saveManagerOpen}
          onOpenChange={setSaveManagerOpen}
          onLoadSave={handleLoadSave}
          onMultiplayerSave={handleMultiplayerSave}
        />

        <ArchiveManagerDialog
          open={archiveManagerOpen}
          onOpenChange={setArchiveManagerOpen}
        />

        {/* 角色面板对话框 */}
        <CharacterPanelDialog
          open={characterPanelOpen}
          onOpenChange={setCharacterPanelOpen}
        />

        {/* 记忆管理弹窗 */}
        <MemoryManagerDialog
          open={memoryManagerOpen}
          onOpenChange={setMemoryManagerOpen}
        />

        {/* 检查点管理弹窗 */}
        <CheckpointPanel
          open={checkpointPanelOpen}
          onOpenChange={setCheckpointPanelOpen}
        />

        {/* 房间信息弹窗 */}
        <RoomInfoDialog
          open={roomInfoOpen}
          onOpenChange={setRoomInfoOpen}
          onLeave={handleReturnToTitle}
        />

        {/* 联机存档选项对话框 */}
        <MultiplayerSaveDialog
          open={multiplayerDialogOpen}
          onOpenChange={setMultiplayerDialogOpen}
          save={selectedMultiplayerSave}
          onStartNewParty={handleStartNewParty}
        />
      </div>
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
