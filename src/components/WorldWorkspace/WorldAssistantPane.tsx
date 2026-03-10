/**
 * 世界工作台右侧辅助面板
 */

import { Link2, PackageOpen, Sparkles } from "lucide-react";

import { Panel, ScrollArea } from "@/components/ui";
import type { World } from "@/lib/world/types";
import { color, colorAlpha } from "@/styles/tokens";

interface WorldAssistantPaneProps {
  world: World | null;
  validationMessages: string[];
}

export function WorldAssistantPane({
  world,
  validationMessages,
}: WorldAssistantPaneProps) {
  const dimensionCount = world?.rules.dimensions?.length ?? 0;
  const talentCount = world?.rules.talents?.length ?? 0;
  const attributeCount = world?.rules.primaryAttributes.length ?? 0;

  return (
    <ScrollArea className="h-full px-4 py-4">
      <div className="space-y-4">
        <Panel variant="outlined" className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: color("primary") }}
            />
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                工作台摘要
              </h3>
              <p
                className="mt-1 text-xs"
                style={{ color: colorAlpha("textMuted", 0.74) }}
              >
                第一版聚焦作者态世界规则与叙事启动种子，不接运行时链路。
              </p>
            </div>
          </div>

          <dl
            className="mt-4 space-y-2 text-xs"
            style={{ color: colorAlpha("textMuted", 0.82) }}
          >
            <SummaryRow label="主要属性" value={String(attributeCount)} />
            <SummaryRow label="角色创建维度" value={String(dimensionCount)} />
            <SummaryRow label="可选天赋" value={String(talentCount)} />
            <SummaryRow
              label="叙事启动"
              value={
                world?.narrative?.script || world?.narrative?.opening
                  ? "已配置"
                  : "未配置"
              }
            />
          </dl>
        </Panel>

        <Panel variant="outlined" className="p-4">
          <div className="flex items-start gap-3">
            <PackageOpen
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: color("secondary") }}
            />
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                结构化编辑覆盖范围
              </h3>
              <ul
                className="mt-2 list-disc space-y-1 pl-4 text-xs"
                style={{ color: colorAlpha("textMuted", 0.78) }}
              >
                <li>
                  基础信息：`meta.name / description / author / version /
                  source`
                </li>
                <li>叙事启动：`narrative.script / narrative.opening`</li>
                <li>规则最小闭环：主要属性、点数分配、维度、天赋</li>
                <li>复杂规则块通过原始规则编辑 JSON 兜底</li>
              </ul>
            </div>
          </div>
        </Panel>

        <Panel variant="outlined" className="p-4">
          <div className="flex items-start gap-3">
            <Link2
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: color("warning") }}
            />
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: color("textPrimary") }}
              >
                外部绑定占位
              </h3>
              <p
                className="mt-1 text-xs"
                style={{ color: colorAlpha("textMuted", 0.76) }}
              >
                世界书绑定与世界档案联动暂不接入，本工作包仅保留扩展提示，不引入跨系统耦合。
              </p>
              <div
                className="mt-3 rounded-lg border px-3 py-3 text-xs"
                style={{
                  borderColor: colorAlpha("border", 0.3),
                  background: colorAlpha("bgCard", 0.32),
                  color: colorAlpha("textMuted", 0.78),
                }}
              >
                未来可在此处扩展：
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>绑定世界书集合（只读引用）</li>
                  <li>绑定世界档案模板 / 初始种子</li>
                  <li>字段级 schema 校验结果与扩展建议</li>
                </ul>
              </div>
            </div>
          </div>
        </Panel>

        <Panel variant="outlined" className="p-4">
          <h3
            className="text-sm font-semibold"
            style={{ color: color("textPrimary") }}
          >
            当前提示
          </h3>
          {validationMessages.length > 0 ? (
            <ul
              className="mt-2 list-disc space-y-1 pl-4 text-xs"
              style={{ color: colorAlpha("textMuted", 0.78) }}
            >
              {validationMessages.map((message, index) => (
                <li
                  key={
                    message
                      ? `${message}-${index}`
                      : `validation-message-${index}`
                  }
                >
                  {message}
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="mt-2 text-xs"
              style={{ color: colorAlpha("textMuted", 0.74) }}
            >
              当前没有额外提示，结构化配置处于可保存状态。
            </p>
          )}
        </Panel>
      </div>
    </ScrollArea>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd style={{ color: color("textPrimary") }}>{value}</dd>
    </div>
  );
}
