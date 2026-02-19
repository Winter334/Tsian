/**
 * 关于页面
 * 显示版本号和更新日志
 */

import { changelog, getCurrentVersion } from "@/config/changelog";
import { cn } from "@/lib/utils";
import { animation, color, colorAlpha } from "@/styles/tokens";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Heart } from "lucide-react";

interface AboutPageProps {
  onBack: () => void;
}

export function AboutPage({ onBack }: AboutPageProps) {
  const currentVersion = getCurrentVersion();

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

      {/* Logo 和版本信息 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-6 rounded-lg"
        style={{
          background: colorAlpha("bgElevated", 0.5),
          border: `1px solid ${colorAlpha("primary", 0.2)}`,
        }}
      >
        {/* Logo */}
        <div
          className="text-4xl font-bold mb-2"
          style={{
            background: `linear-gradient(135deg, ${color("primary")}, ${color(
              "secondary",
            )})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          此间
        </div>

        {/* 版本号 */}
        <div
          className="text-lg font-medium mb-2"
          style={{ color: color("textPrimary") }}
        >
          此间 Tsian v{currentVersion}
        </div>

        {/* 描述 */}
        <div className="text-sm" style={{ color: color("textSecondary") }}>
          AI 角色扮演游戏框架
        </div>
      </motion.div>

      {/* 更新日志 */}
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
        <h3
          className="text-sm font-semibold mb-3 flex items-center gap-2"
          style={{ color: color("textPrimary") }}
        >
          <FileText className="w-4 h-4" style={{ color: color("primary") }} />
          更新日志
        </h3>

        <div
          className="space-y-4 max-h-75 overflow-y-auto pr-2"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: `${colorAlpha("primary", 0.3)} transparent`,
          }}
        >
          {changelog.map((entry, index) => (
            <div key={entry.version}>
              {/* 版本标题 */}
              <div
                className="text-sm font-medium mb-2 pb-1"
                style={{
                  color: color("textSecondary"),
                  borderBottom: `1px solid ${colorAlpha("primary", 0.15)}`,
                }}
              >
                v{entry.version}{" "}
                <span style={{ color: color("textMuted") }}>
                  ({entry.date})
                </span>
              </div>

              {/* 更新内容 */}
              <ul className="space-y-1">
                {entry.changes.map((change, changeIndex) => (
                  <li
                    key={changeIndex}
                    className="text-sm flex items-start gap-2"
                    style={{ color: color("textSecondary") }}
                  >
                    <span style={{ color: color("primary") }}>•</span>
                    {change}
                  </li>
                ))}
              </ul>

              {/* 分隔线（非最后一项） */}
              {index < changelog.length - 1 && (
                <div
                  className="mt-3"
                  style={{
                    borderBottom: `1px dashed ${colorAlpha("primary", 0.1)}`,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* 底部信息 */}
      <div
        className="text-center text-xs flex items-center justify-center gap-1"
        style={{ color: color("textMuted") }}
      >
        Made with{" "}
        <Heart
          className="w-3 h-3"
          style={{ color: color("error"), fill: color("error") }}
        />{" "}
        for AIRP enthusiasts
      </div>
    </div>
  );
}
