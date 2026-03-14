import type { LucideIcon } from "lucide-react";
import { Package, TrendingUp, Zap } from "lucide-react";

export type WorldEditorSectionId =
  | "meta"
  | "narrative"
  | "attributes"
  | "derivedStats"
  | "checkRules"
  | "conditions"
  | "dimensions"
  | "talents"
  | "level-system"
  | "inventoryRules"
  | "itemTemplates"
  | "skillTemplates";

export type WorldEditorSectionDefinition = {
  id: WorldEditorSectionId;
  title: string;
  description: string;
  icon?: LucideIcon | string;
};

export const WORLD_EDITOR_SECTIONS: WorldEditorSectionDefinition[] = [
  {
    id: "meta",
    title: "基础信息",
    description: "维护作者态世界元信息与说明。",
  },
  {
    id: "narrative",
    title: "叙事启动",
    description: "编辑 script / opening 作者态种子。",
  },
  {
    id: "attributes",
    title: "属性与点数",
    description: "配置主要属性与角色创建点数规则。",
  },
  {
    id: "derivedStats",
    title: "衍生属性",
    description: "配置公式、边界、UI 显示与资源字段。",
  },
  {
    id: "checkRules",
    title: "检定规则",
    description: "配置默认骰、阈值、DC 预设与 AI 难度参考。",
  },
  {
    id: "conditions",
    title: "状态",
    description: "维护状态名称、持续时间与基础触发模式。",
  },
  {
    id: "dimensions",
    title: "角色维度",
    description: "配置种族、背景等创建维度与选项。",
  },
  {
    id: "talents",
    title: "天赋",
    description: "维护可选天赋与基础前置规则。",
  },
  {
    id: "level-system",
    title: "等级系统",
    description: "配置升级进度、成长模式、资源恢复与叙事反馈。",
    icon: TrendingUp,
  },
  {
    id: "inventoryRules",
    title: "装备系统",
    description: "配置装备槽位与背包规则",
    icon: "⚔️",
  },
  {
    id: "itemTemplates",
    title: "物品模板",
    description: "维护物品模板的基础属性与效果。",
    icon: Package,
  },
  {
    id: "skillTemplates",
    title: "技能模板",
    description: "维护技能模板的基础属性、消耗与前置条件。",
    icon: Zap,
  },
];
