/**
 * 默认示例世界书
 *
 * 异世界风格的基础冒险设定，作为用户的起始模板。
 */

import type { Lorebook } from "../types";

/**
 * Lyra 默认示例世界书
 */
export const defaultLorebook: Lorebook = {
  id: "lyra-isekai",
  name: "异世界冒险书",
  description: "异世界风格的基础冒险设定，包含起始城镇和周边区域",
  entries: [
    {
      id: "core-rules",
      name: "世界基础规则",
      content:
        "这是一个融合了剑与魔法的异世界。冒险者通过冒险者公会接取委托，在这片土地上探索、战斗、成长。\n核心规则：\n- 尊重骰子判定结果，2d6 为基础判定骰\n- 保持世界观一致性\n- NPC 有自己的意志和动机\n- 魔法和剑技并存，元素属性（火/冰/雷/光/暗）影响战斗",
      enabled: true,
      activationStrategy: "constant",
      primaryKeywords: [],
      scanDepth: null,
      order: 0,
    },
    {
      id: "starter-town",
      name: "始まりの街",
      content:
        "「始まりの街」是新人冒险者最常聚集的城镇。城镇中央有冒险者公会总部，提供从 E 级到 S 级的各类委托。街道上商店、锻冶屋、药师铺一应俱全。城镇被石墙环绕，北门通往平原，东门通往森林。",
      enabled: true,
      activationStrategy: "selective",
      primaryKeywords: ["城镇", "公会", "始まり", "商店", "锻冶"],
      scanDepth: null,
      order: 10,
    },
    {
      id: "guild-system",
      name: "冒险者公会",
      content:
        "冒险者公会是管理冒险者和委托的官方组织。冒险者等级从 E（新人）到 S（传说级）。公会柜台的接待员会根据冒险者等级推荐合适的委托。完成委托可获得报酬和经验，积累足够贡献可以升级。",
      enabled: true,
      activationStrategy: "selective",
      primaryKeywords: ["公会", "冒险者", "委托", "等级", "升级"],
      scanDepth: null,
      order: 20,
    },
    {
      id: "enchanted-forest",
      name: "精灵森林",
      content:
        "城镇东面的广袤森林，据说曾是精灵族的领地。森林浅层栖息着哥布林和野狼等低级魔物，适合新人冒险者练级。森林深处传闻有古代遗迹和强大的魔兽守护着。",
      enabled: true,
      activationStrategy: "selective",
      primaryKeywords: ["森林", "精灵", "哥布林", "魔物", "遗迹"],
      scanDepth: null,
      order: 30,
    },
  ],
  settings: {
    defaultScanDepth: 2,
    caseSensitive: false,
    tokenBudget: 0,
  },
  metadata: {
    version: "2.0.0",
    createdAt: 1738972800000,
    updatedAt: 1738972800000,
  },
};
