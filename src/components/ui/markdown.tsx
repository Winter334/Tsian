/**
 * Markdown 渲染组件
 * 用于渲染叙事文本，支持 HTML
 */

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          // 自定义段落样式
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
          ),
          // 自定义强调样式
          strong: ({ children }) => (
            <strong className="font-bold text-cyan-400">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-cyan-300/80">{children}</em>
          ),
          // 自定义引用块
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-cyan-500/50 pl-4 my-4 text-gray-300 italic">
              {children}
            </blockquote>
          ),
          // 自定义代码块
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-gray-800 rounded text-cyan-300 text-sm">
                  {children}
                </code>
              );
            }
            return (
              <code className="block p-4 bg-gray-900 rounded-lg overflow-x-auto text-sm">
                {children}
              </code>
            );
          },
          // 自定义列表
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-1">
              {children}
            </ol>
          ),
          // 自定义分割线
          hr: () => <hr className="my-6 border-t border-cyan-500/30" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
