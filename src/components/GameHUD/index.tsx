import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";

import { animation, colorAlpha } from "@/styles/tokens";

import { HubReturnButton } from "./HubReturnButton";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { SidebarDrawer } from "./SidebarDrawer";

interface GameHUDProps {
  onReturnToHub: () => void;
  onOpenCharacterPanel: () => void;
  children: ReactNode;
}

interface MobileSidebarButtonProps {
  side: "left" | "right";
  onClick: () => void;
  className?: string;
}

function MobileSidebarButton({
  side,
  onClick,
  className,
}: MobileSidebarButtonProps) {
  const positionClass = side === "left" ? "left-3" : "right-14";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={[
        "md:hidden absolute top-3 z-40",
        positionClass,
        "w-10 h-10 rounded-full",
        "inline-flex items-center justify-center",
        "backdrop-blur-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        background: colorAlpha("bgElevated", 0.58),
        border: `1px solid ${colorAlpha("primary", 0.2)}`,
        color: colorAlpha("textPrimary", 0.95),
      }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: animation.duration.fast }}
      aria-label={side === "left" ? "打开角色状态" : "打开场景角色"}
    >
      <Menu className="w-4 h-4" />
    </motion.button>
  );
}

export function GameHUD({
  onReturnToHub,
  onOpenCharacterPanel,
  children,
}: GameHUDProps) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className="relative h-dvh flex">
      <aside
        className="hidden md:flex md:flex-col w-80 shrink-0 overflow-y-auto"
        style={{
          borderRight: `1px solid ${colorAlpha("primary", 0.15)}`,
          background: colorAlpha("bgElevated", 0.8),
        }}
      >
        <LeftSidebar onOpenCharacterPanel={onOpenCharacterPanel} />
      </aside>

      <main className="flex-1 min-w-0 relative overflow-hidden">
        <MobileSidebarButton side="left" onClick={() => setLeftOpen(true)} />
        <MobileSidebarButton side="right" onClick={() => setRightOpen(true)} />

        <HubReturnButton onClick={onReturnToHub} />

        {children}

        <SidebarDrawer
          side="left"
          open={leftOpen}
          onClose={() => setLeftOpen(false)}
        >
          <LeftSidebar onOpenCharacterPanel={onOpenCharacterPanel} />
        </SidebarDrawer>

        <SidebarDrawer
          side="right"
          open={rightOpen}
          onClose={() => setRightOpen(false)}
        >
          <RightSidebar />
        </SidebarDrawer>
      </main>

      <aside
        className="hidden md:flex md:flex-col w-80 shrink-0 overflow-y-auto"
        style={{
          borderLeft: `1px solid ${colorAlpha("primary", 0.15)}`,
          background: colorAlpha("bgElevated", 0.8),
        }}
      >
        <RightSidebar />
      </aside>
    </div>
  );
}

export type { GameHUDProps };
