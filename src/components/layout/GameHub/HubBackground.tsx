import { useMemo } from "react";

import { StarfieldBackground } from "@/components/effects";
import { useThemeEffectSwitches } from "@/hooks";
import { color, colorAlpha, createGridBackground } from "@/styles/tokens";

/**
 * Hub 背景层：基础底色 + 星空粒子 + 可选网格叠加
 */
export function HubBackground() {
  const { isParticlesEnabled, isMatrixRainEnabled } = useThemeEffectSwitches();

  const gridStyles = useMemo(() => {
    if (!isMatrixRainEnabled) {
      return null;
    }

    return createGridBackground(0.05, 56);
  }, [isMatrixRainEnabled]);

  return (
    <div className="absolute inset-0" style={{ background: color("bgBase") }}>
      {isParticlesEnabled && (
        <div className="absolute inset-0 pointer-events-none">
          <StarfieldBackground transparentBackground useThemeColors />
        </div>
      )}

      {gridStyles && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            ...gridStyles,
            boxShadow: `inset 0 0 120px ${colorAlpha("bgBase", 0.75)}`,
          }}
        />
      )}
    </div>
  );
}
