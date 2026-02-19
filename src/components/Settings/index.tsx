/**
 * 设置中心
 * 统一的设置入口，卡片网格布局
 * 使用统一入场动画
 */

import { Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks";
import type {
  ExportData,
  ImportPreview as ImportPreviewType,
} from "@/modules/data";
import { generateImportPreview, parseImportFile } from "@/modules/data";
import {
  animation,
  stepBackwardVariants,
  stepForwardVariants,
} from "@/styles/tokens";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bot,
  Database,
  FileText,
  Globe,
  Info,
  Palette,
  Settings,
  User,
} from "lucide-react";
import { useCallback, useState } from "react";
import { AboutPage } from "./AboutPage";
import { AISettings } from "./AISettings";
import { DataManagement } from "./DataManagement";
import { ImportPreview } from "./ImportPreview";
import { MultiplayerSettings } from "./MultiplayerSettings";
import { PlayerIdentity } from "./PlayerIdentity";
import { SettingsCard } from "./SettingsCard";

/** 设置页面类型 */
type SettingsPage =
  | "home"
  | "ai"
  | "data"
  | "multiplayer"
  | "appearance"
  | "player"
  | "about"
  | "presets";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 打开预设工作区的回调 */
  onOpenPresetWorkspace?: () => void;
  /** 打开世界书工作区的回调 */
  onOpenLorebookWorkspace?: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onOpenPresetWorkspace,
  onOpenLorebookWorkspace,
}: SettingsDialogProps) {
  const [currentPage, setCurrentPage] = useState<SettingsPage>("home");
  const { toast } = useToast();

  // 导入预览状态
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewType | null>(
    null,
  );
  const [importData, setImportData] = useState<ExportData | null>(null);

  // 关闭时由 Dialog 退出完成回调重置页面，避免硬编码延迟
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleDialogExitComplete = useCallback(() => {
    setCurrentPage("home");
  }, []);

  // 返回首页
  const handleBack = () => {
    setCurrentPage("home");
  };

  // 处理导入文件预览
  const handleImportPreview = useCallback(
    async (file: File) => {
      const result = await parseImportFile(file);

      if ("error" in result) {
        toast("error", "文件解析失败", result.error);
        return;
      }

      const preview = generateImportPreview(result.data);
      setImportPreview(preview);
      setImportData(result.data);
      setImportPreviewOpen(true);
    },
    [toast],
  );

  // 导入完成后的回调
  const handleImportComplete = useCallback(() => {
    setImportPreview(null);
    setImportData(null);
  }, []);

  // 处理预设管理入口点击
  const handlePresetsClick = useCallback(() => {
    if (onOpenPresetWorkspace) {
      onOpenChange(false); // 关闭设置弹
      onOpenPresetWorkspace(); // 打开预设工作区
    }
  }, [onOpenChange, onOpenPresetWorkspace]);

  // 处理世界书管理入口点击
  const handleLorebookClick = useCallback(() => {
    if (onOpenLorebookWorkspace) {
      onOpenChange(false); // 关闭设置弹窗
      onOpenLorebookWorkspace(); // 打开世界书工作区
    }
  }, [onOpenChange, onOpenLorebookWorkspace]);

  // 获取当前页面标题
  const getPageTitle = () => {
    switch (currentPage) {
      case "home":
        return "系统设置";
      case "ai":
        return "AI 设置";
      case "data":
        return "数据管理";
      case "multiplayer":
        return "联机设置";
      case "appearance":
        return "外观";
      case "player":
        return "玩家身份";
      case "about":
        return "关于";
      case "presets":
        return "预设管理";
      default:
        return "系统设置";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          title={getPageTitle()}
          width={
            currentPage === "home" ? "lg" : currentPage === "ai" ? 920 : "md"
          }
          animateSize
          animateLifecycle
          onExitComplete={handleDialogExitComplete}
        >
          <motion.div
            layout
            transition={{
              duration: 0.25,
              ease: animation.easing.smooth,
            }}
            className="relative px-1 py-1"
          >
            {/* 页面切换动画（使用统一步骤动画变体） */}
            <AnimatePresence mode="wait" initial={false}>
              {currentPage === "home" && (
                <motion.div
                  key="home"
                  className="w-full"
                  variants={stepBackwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <SettingsHome
                    onNavigate={setCurrentPage}
                    onPresetsClick={handlePresetsClick}
                    onLorebookClick={handleLorebookClick}
                  />
                </motion.div>
              )}

              {currentPage === "ai" && (
                <motion.div
                  key="ai"
                  className="w-full"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <AISettings onBack={handleBack} />
                </motion.div>
              )}

              {currentPage === "data" && (
                <motion.div
                  key="data"
                  className="w-full"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <DataManagement
                    onBack={handleBack}
                    onImportPreview={handleImportPreview}
                  />
                </motion.div>
              )}

              {currentPage === "multiplayer" && (
                <motion.div
                  key="multiplayer"
                  className="w-full"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <MultiplayerSettings onBack={handleBack} />
                </motion.div>
              )}

              {currentPage === "player" && (
                <motion.div
                  key="player"
                  className="w-full"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <PlayerIdentity onBack={handleBack} />
                </motion.div>
              )}

              {currentPage === "about" && (
                <motion.div
                  key="about"
                  className="w-full"
                  variants={stepForwardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <AboutPage onBack={handleBack} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* 导入预览弹窗 - 独立于设置弹窗 */}
      <ImportPreview
        open={importPreviewOpen}
        onOpenChange={setImportPreviewOpen}
        preview={importPreview}
        data={importData}
        onImportComplete={handleImportComplete}
      />
    </>
  );
}

/**
 * 设置首页 - 卡片网格
 */
interface SettingsHomeProps {
  onNavigate: (page: SettingsPage) => void;
  onPresetsClick?: () => void;
  onLorebookClick?: () => void;
}

function SettingsHome({
  onNavigate,
  onPresetsClick,
  onLorebookClick,
}: SettingsHomeProps) {
  const cards = [
    {
      id: "player",
      icon: <User className="w-6 h-6" />,
      title: "玩家身份",
      description: "身份标识、名称修改、恢复身份",
      onClick: () => onNavigate("player"),
    },
    {
      id: "ai",
      icon: <Bot className="w-6 h-6" />,
      title: "AI 设置",
      description: "API 配置、模型选择、高级参数",
      onClick: () => onNavigate("ai"),
    },
    {
      id: "presets",
      icon: <FileText className="w-6 h-6" />,
      title: "预设管理",
      description: "提示词预设、导入导出",
      onClick: onPresetsClick,
    },
    {
      id: "lorebook",
      icon: <BookOpen className="w-6 h-6" />,
      title: "世界书管理",
      description: "世界观设定、条目管理",
      onClick: onLorebookClick,
    },
    {
      id: "data",
      icon: <Database className="w-6 h-6" />,
      title: "数据管理",
      description: "导出/导入、存储空间",
      onClick: () => onNavigate("data"),
    },
    {
      id: "multiplayer",
      icon: <Globe className="w-6 h-6" />,
      title: "联机设置",
      description: "服务器配置、连接选项",
      onClick: () => onNavigate("multiplayer"),
    },
    {
      id: "appearance",
      icon: <Palette className="w-6 h-6" />,
      title: "外观",
      description: "主题切换、动画效果",
      disabled: true,
      disabledText: "即将推出",
    },
    {
      id: "about",
      icon: <Info className="w-6 h-6" />,
      title: "关于",
      description: "版本信息、更新日志",
      onClick: () => onNavigate("about"),
    },
  ] as const;

  return (
    <motion.div
      className="grid grid-cols-2 gap-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.04,
          },
        },
      }}
    >
      {cards.map((card) => {
        const { id, ...cardProps } = card;
        return (
          <motion.div
            key={id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.15, ease: "easeOut" },
              },
            }}
          >
            <SettingsCard {...cardProps} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/**
 * 设置按钮
 */
interface SettingsButtonProps {
  className?: string;
}

export function SettingsButton({ className }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Settings className="w-5 h-5" />
      </Button>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
