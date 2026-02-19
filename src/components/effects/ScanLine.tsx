/**
 * 扫描线组件
 * 赛博朋克风格的扫描线动画叠加层
 */

import { color } from "@/styles/tokens";

export function ScanLine() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="scan-line" />
      <style>{`
        .scan-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: linear-gradient(
            to right,
            transparent,
            ${color("primary")},
            transparent
          );
          opacity: 0.6;
          box-shadow: 0 0 10px ${color("primary")},
                      0 0 20px ${color("primary")},
                      0 0 30px ${color("primary")};
          animation: scan-line 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
