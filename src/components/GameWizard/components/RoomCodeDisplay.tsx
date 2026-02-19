/**
 * 房间码显示组件
 *
 * 显示房间码并提供复制功能
 */

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface RoomCodeDisplayProps {
  code: string;
  size?: "sm" | "md" | "lg";
  showCopy?: boolean;
}

export function RoomCodeDisplay({
  code,
  size = "md",
  showCopy = true,
}: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-mono tracking-widest text-primary ${sizeClasses[size]}`}
      >
        {code}
      </span>
      {showCopy && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-primary"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      )}
    </div>
  );
}
