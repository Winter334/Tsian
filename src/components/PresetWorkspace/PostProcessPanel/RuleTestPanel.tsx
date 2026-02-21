/**
 * 后处理规则实时测试面板
 *
 * 特性：
 * - 默认折叠
 * - 输入测试文本后实时计算结果
 * - 展示清理文本、提取数据与警告信息
 */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";

import { Textarea } from "@/components/ui";
import {
  executePostProcessPipeline,
  type PostProcessRule,
} from "@/lib/post-process";
import { cn } from "@/lib/utils";
import { animation, borders, color, colorAlpha } from "@/styles/tokens";

export interface RuleTestPanelProps {
  rules: PostProcessRule[];
}

interface TestResult {
  text: string;
  extracted: Record<string, string[]>;
  warnings: string[];
}

/**
 * 规则测试面板。
 */
export function RuleTestPanel({ rules }: RuleTestPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputText, setInputText] = useState("");

  const result = useMemo<TestResult>(() => {
    const persistResult = executePostProcessPipeline(
      inputText,
      rules,
      "persist",
    );
    const renderResult = executePostProcessPipeline(
      persistResult.text,
      rules,
      "render",
    );

    const mergedExtracted: Record<string, string[]> = {
      ...persistResult.extracted,
    };
    for (const [key, values] of Object.entries(renderResult.extracted)) {
      const previous = mergedExtracted[key] ?? [];
      mergedExtracted[key] = [...previous, ...values];
    }

    return {
      text: renderResult.text,
      extracted: mergedExtracted,
      warnings: [...persistResult.warnings, ...renderResult.warnings],
    };
  }, [inputText, rules]);

  const extractedEntries = Object.entries(result.extracted);

  return (
    <div
      className="rounded-md border"
      style={{
        borderColor: colorAlpha("primary", 0.22),
        background: colorAlpha("bgElevated", 0.28),
        borderRadius: borders.radius.md,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical size={15} style={{ color: color("primary") }} />
          <span
            className="text-sm font-medium"
            style={{ color: color("textSecondary") }}
          >
            实时规则测试
          </span>
          <span className="text-xs" style={{ color: color("textMuted") }}>
            （默认折叠）
          </span>
        </span>

        <ChevronDown
          size={16}
          className={cn("transition-transform", expanded && "rotate-180")}
          style={{
            color: color("textMuted"),
            transitionDuration: `${animation.duration.fast * 1000}ms`,
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: animation.duration.normal }}
            className="overflow-hidden"
          >
            <div
              className="flex flex-col gap-3 border-t px-3 pb-3 pt-2"
              style={{ borderColor: colorAlpha("primary", 0.2) }}
            >
              <div className="flex flex-col gap-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: color("textSecondary") }}
                >
                  测试输入
                </span>
                <Textarea
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  placeholder="粘贴需要测试的 AI 输出文本..."
                  className="min-h-28 text-sm"
                />
              </div>

              <ResultSection title="清理后文本">
                <pre
                  className="max-h-44 overflow-auto rounded p-2 text-xs whitespace-pre-wrap"
                  style={{
                    background: colorAlpha("bgBase", 0.42),
                    color: color("textSecondary"),
                    border: `1px solid ${colorAlpha("primary", 0.2)}`,
                    borderRadius: borders.radius.sm,
                  }}
                >
                  {result.text || "（空）"}
                </pre>
              </ResultSection>

              <ResultSection title="提取数据">
                {extractedEntries.length === 0 ? (
                  <EmptyHint text="暂无提取数据" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {extractedEntries.map(([key, values]) => (
                      <div
                        key={key}
                        className="rounded border px-2 py-1.5"
                        style={{
                          borderColor: colorAlpha("primary", 0.2),
                          background: colorAlpha("bgBase", 0.32),
                        }}
                      >
                        <div
                          className="text-xs font-semibold"
                          style={{ color: color("primary") }}
                        >
                          {key}
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {values.map((value, index) => (
                            <code
                              key={`${key}-${index}`}
                              className="text-xs whitespace-pre-wrap"
                              style={{ color: color("textSecondary") }}
                            >
                              {value}
                            </code>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ResultSection>

              <ResultSection title="警告信息">
                {result.warnings.length === 0 ? (
                  <EmptyHint text="无警告" />
                ) : (
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-xs">
                    {result.warnings.map((warning, index) => (
                      <li
                        key={`warning-${index}`}
                        style={{ color: color("warning") }}
                      >
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}
              </ResultSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-xs font-medium"
        style={{ color: color("textSecondary") }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      className="rounded border border-dashed px-3 py-2 text-xs"
      style={{
        borderColor: colorAlpha("primary", 0.22),
        color: color("textMuted"),
        background: colorAlpha("bgBase", 0.26),
      }}
    >
      {text}
    </div>
  );
}
