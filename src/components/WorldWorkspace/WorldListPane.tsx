/**
 * 世界列表面板
 */

import { CheckCircle2, Radio, Trash2 } from "lucide-react";

import { Button, Card, ScrollArea } from "@/components/ui";
import type { WorldId, WorldIndex } from "@/lib/world";
import { color, colorAlpha } from "@/styles/tokens";

interface WorldListPaneProps {
  worlds: WorldIndex[];
  activeWorldId: WorldId | null;
  selectedWorldId: WorldId | null;
  onSelectWorld: (id: WorldId) => void;
  onSetActiveWorld: (id: WorldId) => void;
  onDeleteWorld: (id: WorldId) => void;
}

function formatTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "未记录";
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
  });
}

export function WorldListPane({
  worlds,
  activeWorldId,
  selectedWorldId,
  onSelectWorld,
  onSetActiveWorld,
  onDeleteWorld,
}: WorldListPaneProps) {
  return (
    <div className="flex h-full flex-col">
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: colorAlpha("primary", 0.16) }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: color("textPrimary") }}
        >
          世界列表
        </h2>
        <p
          className="mt-1 text-xs"
          style={{ color: colorAlpha("textMuted", 0.72) }}
        >
          选择一个作者态世界进行编辑或切换活动世界
        </p>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-3">
          {worlds.map((world) => {
            const isSelected = world.id === selectedWorldId;
            const isActive = world.id === activeWorldId;
            const sourceLabel = world.source === "lyra" ? "内置" : "自定义";

            return (
              <Card
                key={world.id}
                variant={isSelected ? "elevated" : "outlined"}
                hover
                onClick={() => onSelectWorld(world.id)}
                className="p-4"
                style={
                  isSelected
                    ? {
                        borderColor: color("primary"),
                        boxShadow: `0 0 20px ${colorAlpha("primary", 0.14)}`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="truncate text-sm font-semibold"
                        style={{ color: color("textPrimary") }}
                      >
                        {world.name || "未命名世界"}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          background: colorAlpha(
                            world.source === "lyra" ? "secondary" : "primary",
                            0.12,
                          ),
                          color: color(
                            world.source === "lyra" ? "secondary" : "primary",
                          ),
                        }}
                      >
                        {sourceLabel}
                      </span>
                      {isActive && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px]"
                          style={{
                            background: colorAlpha("success", 0.14),
                            color: color("success"),
                          }}
                        >
                          当前活动
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-2 text-xs"
                      style={{ color: colorAlpha("textMuted", 0.72) }}
                    >
                      最近更新：{formatTimestamp(world.updatedAt)}
                    </p>
                  </div>

                  {isSelected ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: color("primary") }}
                    />
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant={isActive ? "secondary" : "outline"}
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSetActiveWorld(world.id);
                    }}
                    className="gap-1.5"
                  >
                    <Radio className="h-4 w-4" />
                    {isActive ? "已活动" : "设为活动"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={worlds.length <= 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteWorld(world.id);
                    }}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                </div>
              </Card>
            );
          })}

          {worlds.length === 0 && (
            <div className="flex h-48 items-center justify-center text-center">
              <div>
                <p className="text-sm" style={{ color: color("textMuted") }}>
                  暂无世界配置
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: colorAlpha("textMuted", 0.68) }}
                >
                  请从顶部工具栏新建或导入世界
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
