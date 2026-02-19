/**
 * 数据管理页面
 * 导出/导入 + 存储空间监控
 */

import { Button } from "@/components/ui";
import { StorageIndicator } from "@/core/yjs";
import { DataCommands } from "@/domain/commands/data";
import { useCommand, useToast } from "@/hooks";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha } from "@/styles/tokens";
import { motion } from "framer-motion";
import { ArrowLeft, Download, HardDrive, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface DataManagementProps {
  onBack: () => void;
  onImportPreview?: (file: File) => void;
}

export function DataManagement({
  onBack,
  onImportPreview,
}: DataManagementProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  // 通过 CommandBus 发送命令
  const dispatch = useCommand();

  // 导出全部存档 - 通过 CommandBus
  const handleExportAll = useCallback(async () => {
    setExporting(true);
    try {
      const result = await dispatch({
        type: DataCommands.EXPORT_ALL,
        payload: {},
      });

      if (result.success) {
        toast("success", "导出成功", "已导出全部存档");
      } else {
        toast("error", "导出失败", result.error || "请稍后重试");
      }
    } catch {
      toast("error", "导出失败", "请稍后重试");
    } finally {
      setExporting(false);
    }
  }, [dispatch, toast]);

  // 选择文件导入
  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 文件选择后处理
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (onImportPreview) {
          onImportPreview(file);
        } else {
          toast("info", "导入功能", "导入预览功能即将推出");
        }
      }
      // 重置 input 以便可以再次选择同一文件
      e.target.value = "";
    },
    [onImportPreview, toast],
  );

  return (
    <div className="space-y-4">
      {/* 返回按钮 */}
      <button
        type="button"
        onClick={onBack}
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          `transition-colors duration-[${animation.duration.fast * 1000}ms]`,
        )}
        style={{ color: color("textSecondary") }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = color("primary");
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = color("textSecondary");
        }}
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </button>

      {/* 导出数据卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg p-4"
        style={{
          background: colorAlpha("bgElevated", 0.5),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          <Download
            className="w-5 h-5 mt-0.5"
            style={{ color: color("primary") }}
          />
          <div className="flex-1">
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: color("textPrimary") }}
            >
              导出数据
            </h3>
            <p className="text-sm" style={{ color: color("textSecondary") }}>
              将游戏数据导出为 JSON 文件，可用于备份或迁移
            </p>
            <p className="text-xs mt-1" style={{ color: color("textMuted") }}>
              角色图片等本地资源不包含在导出的 JSON 文件中
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exporting}
          >
            {exporting ? "导出中..." : "导出全部存档"}
          </Button>
        </div>
      </motion.div>

      {/* 提示信息 */}
      <p className="text-xs px-1" style={{ color: color("textMuted") }}>
        提示：单个存档可在「存档管理」中导出
      </p>

      {/* 导入数据卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-lg p-4"
        style={{
          background: colorAlpha("bgElevated", 0.5),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          <Upload
            className="w-5 h-5 mt-0.5"
            style={{ color: color("secondary") }}
          />
          <div className="flex-1">
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: color("textPrimary") }}
            >
              导入数据
            </h3>
            <p className="text-sm" style={{ color: color("textSecondary") }}>
              从 JSON 文件导入游戏数据
            </p>
            <p className="text-xs mt-1" style={{ color: color("textMuted") }}>
              导入的存档将生成新 ID，不会覆盖现有数据
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleFileSelect}>
            选择文件导入
          </Button>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </motion.div>

      {/* 存储空间卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-lg p-4"
        style={{
          background: colorAlpha("bgElevated", 0.5),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-5 h-5" style={{ color: color("primary") }} />
          <h3
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            存储空间
          </h3>
        </div>

        <StorageIndicator />
      </motion.div>
    </div>
  );
}
