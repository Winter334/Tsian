import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import { CheckpointButton } from "@/modules/checkpoint/components/CheckpointButton";
import {
  CharacterButton,
  CharacterPanelDialog,
} from "./components/CharacterPanel";
import {
  GameWizard,
  type GameMode,
  type WizardResult,
} from "./components/GameWizard";
import {
  LorebookButton,
  LorebookWorkspace,
} from "./components/LorebookWorkspace";
import { RoomInfoButton } from "./components/Multiplayer";
import { MultiplayerSaveDialog } from "./components/MultiplayerSaveDialog";
import { Onboarding } from "./components/Onboarding";
import { PresetButton, PresetWorkspace } from "./components/PresetWorkspace";
import { SaveManagerDialog } from "./components/SaveManager";
import { SettingsDialog } from "./components/Settings";
import { SplashScreen } from "./components/SplashScreen";
import { TitleScreen } from "./components/TitleScreen";
import { AppShell } from "./components/layout";
import { ToastProvider, useToast } from "./components/ui";
import { StorageWarningBanner, yjsManager } from "./core/yjs";
import type { SaveMemberInfo, SaveSlotInfo } from "./core/yjs/types";
import { RoomCommands } from "./domain/commands/room";
import { SaveCommands } from "./domain/commands/save";
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
// 通过顶层模块入口导入，确保松耦合
import {
  GameView,
  MemoryButton,
  useCurrentSaveId,
  useRoomStore,
  useSaveSlots,
} from "./modules";
import { useSettingsStore } from "./stores/settings";

type AppState = "splash" | "onboarding" | "title" | "wizard" | "game";

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

  // 监听联机房间状态 - 当在 wizard/game 状态下房间突然变为 null 时返回标题界面
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const mode = useRoomStore((s) => s.mode);

  // 监听房间解散事件（使用 useEvent hook 符合架构规范）
  useEvent(RoomEvents.ROOM_DELETED, () => {
    // 显示提示
    toast("info", "房间已解散", "房主解散了房间");

    // 返回标题界面
    onReturnToTitle();
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
    // 只在 wizard 或 game 状态下检查
    if (appState !== "wizard" && appState !== "game") {
      previousRoomRef.current = false;
      return;
    }

    // 如果之前有房间（联机模式），现在没有了，说明房间被解散或断开
    if (previousRoomRef.current && !currentRoom && mode === "offline") {
      onReturnToTitle();
    }

    // 更新追踪状态
    previousRoomRef.current = !!currentRoom && mode === "online";
  }, [currentRoom, mode, appState, onReturnToTitle]);

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
  const [characterPanelOpen, setCharacterPanelOpen] = useState(false);
  const [selectedMultiplayerSave, setSelectedMultiplayerSave] =
    useState<SaveSlotInfo | null>(null);

  // GameWizard 初始状态（用于"开启新聚会"场景）
  const [wizardInitialStep, setWizardInitialStep] = useState<
    string | undefined
  >(undefined);
  const [wizardInitialContext, setWizardInitialContext] = useState<
    | {
        mode?: GameMode;
        roomId?: string;
        roomCode?: string;
        /** 期望的成员列表（联机续玩时使用） */
        expectedMembers?: SaveMemberInfo[];
      }
    | undefined
  >(undefined);

  const { hasCompletedOnboarding, loadSettings } = useSettingsStore();

  // 获取存档槽位信息（从 Yjs）
  const saves = useSaveSlots();
  const currentSaveId = useCurrentSaveId();

  // 检查是否有存档槽位
  const hasSaveData = saves.length > 0;

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

  useEffect(() => {
    if (presetError) {
      showErrorToast("预设错误", presetError);
      // 清除错误状态
      usePresetStore.getState().clearError();
    }
  }, [presetError, showErrorToast]);

  // 返回标题界面的回调
  const handleReturnToTitle = () => {
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
      // 单人模式：创建新存档
      // 注意：房间状态会在 SAVE_CREATED 事件触发后由 Room 模块自动重置
      const saveResult = await dispatch({
        type: SaveCommands.CREATE_SAVE,
        payload: {
          name: `存档 ${saves.length + 1}`,
          // 传入角色数据，存入 Yjs 存档的 characters 数组
          initialCharacter: result.characterName
            ? {
                name: result.characterName,
                description: result.characterDescription,
                personality: result.characterPersonality,
                appearance: result.characterAppearance,
                // Phase 2 角色创建字段
                dimensionSelections: result.dimensionSelections,
                talentIds: result.talentIds,
                attributes: result.attributes,
              }
            : undefined,
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

        setAppState("game");
      } else {
        setAppState("title");
      }
    } else {
      // 联机模式：直接进入游戏（房间已创建/加入）
      setAppState("game");
    }
  };

  // 向导关闭（取消）
  const handleWizardClose = () => {
    setWizardOpen(false);
    setAppState("title");
  };

  /**
   * 加载单人存档并进入游戏
   */
  const loadSoloSave = async (saveId: string): Promise<boolean> => {
    const loadResult = await dispatch({
      type: SaveCommands.LOAD_SAVE,
      payload: { saveId },
    });

    if (loadResult.success) {
      // 注意：房间状态会在 SAVE_LOADED 事件触发后由 Room 模块自动重置
      setAppState("game");
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
      setWizardInitialStep("waiting-lobby");
      setWizardInitialContext({
        mode: "create-room",
        roomId: roomData.roomId,
        roomCode: roomData.code,
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

  // 打开角色面板
  const handleOpenCharacterPanel = () => {
    setCharacterPanelOpen(true);
  };

  // 从存档管理加载存档后进入游戏
  const handleLoadSave = () => {
    setAppState("game");
  };

  // 返回标题画面
  const handleBackToTitle = () => {
    setAppState("title");
  };

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

        {/* 游戏主界面 */}
        {appState === "game" && (
          <AppShell
            onTitleClick={handleBackToTitle}
            onSettings={handleSettings}
            onSaveManager={handleSaveManager}
            headerExtra={
              <>
                <CharacterButton onClick={handleOpenCharacterPanel} />
                <LorebookButton onClick={handleOpenLorebookWorkspace} />
                <PresetButton onClick={handleOpenPresetWorkspace} />
                <MemoryButton />
                <CheckpointButton />
                <RoomInfoButton onLeave={handleBackToTitle} />
              </>
            }
          >
            <GameView className="h-full" />
          </AppShell>
        )}

        {/* 设置弹窗 */}
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onOpenPresetWorkspace={handleOpenPresetWorkspace}
          onOpenLorebookWorkspace={handleOpenLorebookWorkspace}
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

        {/* 存档管理弹窗 */}
        <SaveManagerDialog
          open={saveManagerOpen}
          onOpenChange={setSaveManagerOpen}
          onLoadSave={handleLoadSave}
          onMultiplayerSave={handleMultiplayerSave}
        />

        {/* 角色面板对话框 */}
        <CharacterPanelDialog
          open={characterPanelOpen}
          onOpenChange={setCharacterPanelOpen}
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
