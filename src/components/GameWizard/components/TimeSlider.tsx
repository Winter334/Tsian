/**
 * TimeSlider 组件
 * 预配置的时间滑块，用于选择回合时长
 *
 * 基于 Slider 组件，预设了：
 * - 刻度标记 [1, 5, 10, 15, 20, 25, 30]
 * - 拖动时显示"X分钟"提示
 * - 默认范围 1-30，步进 1
 */

import { Slider } from "@/components/ui/slider";

export interface TimeSliderProps {
  /** 当前值（分钟） */
  value: number;
  /** 值变化回调 */
  onChange: (value: number) => void;
  /** 最小值（默认1） */
  min?: number;
  /** 最大值（默认30） */
  max?: number;
  /** 步进值（默认1） */
  step?: number;
  /** 刻度标记值数组（默认 [1, 5, 10, 15, 20, 25, 30]） */
  marks?: number[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

export function TimeSlider({
  value,
  onChange,
  min = 1,
  max = 30,
  step = 1,
  marks = [1, 5, 10, 15, 20, 25, 30],
  disabled = false,
  className,
}: TimeSliderProps) {
  return (
    <Slider
      value={value}
      onValueChange={onChange}
      min={min}
      max={max}
      step={step}
      marks={marks}
      showMarkLabels={true}
      showValue={false}
      dragTooltip={(v) => `${v}分钟`}
      disabled={disabled}
      className={className}
    />
  );
}
