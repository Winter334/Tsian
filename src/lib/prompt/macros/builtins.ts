/**
 * 内置宏定义
 *
 * 实现酒馆脚本的核心宏：
 * - 变量宏：getvar, setvar, getglobalvar, setglobalvar
 * - 随机宏：roll, random
 * - 注释宏：//
 */

import type { MacroDefinition, MacroHandler } from "./types";

// ============================================
// 变量宏
// ============================================

/**
 * getvar - 获取本地变量
 * 语法：{{getvar::name}}
 */
const getvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const value = storage.getLocal(name);
  return { content: value || "" };
};

/**
 * setvar - 设置本地变量
 * 语法：{{setvar::name::value}} 或 {{setvar::name::value::more...}}
 * 支持多段值，用 :: 连接
 */
const setvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  // 值是第二个及之后的参数，用 :: 重新连接（因为值本身可能包含 ::）
  const value = args.slice(1).join("::");
  storage.setLocal(name, value);
  return { content: "", hasSideEffect: true };
};

/**
 * getglobalvar - 获取全局变量
 * 语法：{{getglobalvar::name}}
 */
const getglobalvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const value = storage.getGlobal(name);
  return { content: value || "" };
};

/**
 * setglobalvar - 设置全局变量
 * 语法：{{setglobalvar::name::value}}
 */
const setglobalvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const value = args.slice(1).join("::");
  storage.setGlobal(name, value);
  return { content: "", hasSideEffect: true };
};

/**
 * addvar - 增加本地变量值（数值）
 * 语法：{{addvar::name::increment}}
 */
const addvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  const increment = parseFloat(args[1]?.trim() || "0");
  if (!name || isNaN(increment)) {
    return { content: "" };
  }
  const current = parseFloat(storage.getLocal(name) || "0");
  const newValue = (isNaN(current) ? 0 : current) + increment;
  storage.setLocal(name, String(newValue));
  return { content: "", hasSideEffect: true };
};

/**
 * incvar - 本地变量 +1
 * 语法：{{incvar::name}}
 */
const incvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const current = parseFloat(storage.getLocal(name) || "0");
  const newValue = (isNaN(current) ? 0 : current) + 1;
  storage.setLocal(name, String(newValue));
  return { content: "", hasSideEffect: true };
};

/**
 * decvar - 本地变量 -1
 * 语法：{{decvar::name}}
 */
const decvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const current = parseFloat(storage.getLocal(name) || "0");
  const newValue = (isNaN(current) ? 0 : current) - 1;
  storage.setLocal(name, String(newValue));
  return { content: "", hasSideEffect: true };
};

/**
 * addglobalvar - 增加全局变量值（数值）
 * 语法：{{addglobalvar::name::increment}}
 */
const addglobalvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  const increment = parseFloat(args[1]?.trim() || "0");
  if (!name || isNaN(increment)) {
    return { content: "" };
  }
  const current = parseFloat(storage.getGlobal(name) || "0");
  const newValue = (isNaN(current) ? 0 : current) + increment;
  storage.setGlobal(name, String(newValue));
  return { content: "", hasSideEffect: true };
};

/**
 * incglobalvar - 全局变量 +1
 * 语法：{{incglobalvar::name}}
 */
const incglobalvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const current = parseFloat(storage.getGlobal(name) || "0");
  const newValue = (isNaN(current) ? 0 : current) + 1;
  storage.setGlobal(name, String(newValue));
  return { content: "", hasSideEffect: true };
};

/**
 * decglobalvar - 全局变量 -1
 * 语法：{{decglobalvar::name}}
 */
const decglobalvarHandler: MacroHandler = (args, _context, storage) => {
  const name = args[0]?.trim();
  if (!name) {
    return { content: "" };
  }
  const current = parseFloat(storage.getGlobal(name) || "0");
  const newValue = (isNaN(current) ? 0 : current) - 1;
  storage.setGlobal(name, String(newValue));
  return { content: "", hasSideEffect: true };
};

// ============================================
// 随机宏
// ============================================

/**
 * roll - 掷骰子
 * 语法：{{roll:dN}} 或 {{roll:NdM}}
 * 示例：{{roll:d20}} -> 1-20 随机数
 *       {{roll:2d6}} -> 两个 1-6 骰子之和
 */
const rollHandler: MacroHandler = (args) => {
  const diceExpr = args[0]?.trim().toLowerCase();
  if (!diceExpr) {
    return { content: "0" };
  }

  // 解析骰子表达式
  // 格式：NdM 或 dM
  const match = diceExpr.match(/^(\d*)d(\d+)$/);
  if (!match) {
    return { content: "0" };
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);

  if (count <= 0 || sides <= 0) {
    return { content: "0" };
  }

  // 掷骰子
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1;
  }

  return { content: String(total) };
};

/**
 * random - 随机选择
 * 语法：{{random:a,b,c,...}}
 * 示例：{{random:是,否}} -> 随机返回 "是" 或 "否"
 */
const randomHandler: MacroHandler = (args) => {
  // args[0] 是整个参数字符串，已经被 : 分割
  // 但 random 的参数是用 , 分割的
  const options = args[0]?.split(",").map((s) => s.trim()) || [];
  if (options.length === 0) {
    return { content: "" };
  }

  const index = Math.floor(Math.random() * options.length);
  return { content: options[index] };
};

// ============================================
// 注释宏
// ============================================

/**
 * // - 注释
 * 语法：{{//注释内容}}
 * 输出为空，不显示
 */
const commentHandler: MacroHandler = () => {
  return { content: "" };
};

// ============================================
// 导出所有内置宏
// ============================================

/**
 * 所有内置宏定义
 */
export const builtinMacros: MacroDefinition[] = [
  // 变量宏（使用 :: 分隔符）
  {
    name: "getvar",
    separator: "::",
    handler: getvarHandler,
    description: "获取本地变量值",
  },
  {
    name: "setvar",
    separator: "::",
    handler: setvarHandler,
    description: "设置本地变量",
  },
  {
    name: "getglobalvar",
    separator: "::",
    handler: getglobalvarHandler,
    description: "获取全局变量值",
  },
  {
    name: "setglobalvar",
    separator: "::",
    handler: setglobalvarHandler,
    description: "设置全局变量",
  },
  {
    name: "addvar",
    separator: "::",
    handler: addvarHandler,
    description: "增加本地变量值（数值）",
  },
  {
    name: "incvar",
    separator: "::",
    handler: incvarHandler,
    description: "本地变量 +1",
  },
  {
    name: "decvar",
    separator: "::",
    handler: decvarHandler,
    description: "本地变量 -1",
  },
  {
    name: "addglobalvar",
    separator: "::",
    handler: addglobalvarHandler,
    description: "增加全局变量值（数值）",
  },
  {
    name: "incglobalvar",
    separator: "::",
    handler: incglobalvarHandler,
    description: "全局变量 +1",
  },
  {
    name: "decglobalvar",
    separator: "::",
    handler: decglobalvarHandler,
    description: "全局变量 -1",
  },

  // 随机宏（使用 : 分隔符）
  {
    name: "roll",
    separator: ":",
    handler: rollHandler,
    description: "掷骰子，如 {{roll:d20}} 或 {{roll:2d6}}",
  },
  {
    name: "random",
    separator: ":",
    handler: randomHandler,
    description: "随机选择，如 {{random:是,否}}",
  },

  // 注释宏（特殊处理）
  {
    name: "//",
    separator: ":",
    handler: commentHandler,
    description: "注释，不输出",
  },
];
