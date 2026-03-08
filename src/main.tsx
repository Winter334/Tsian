/**
 * 应用入口文件
 *
 * 这是应用的启动入口，包含内部使用的 ErrorPage 组件，不需要导出
 */
/* eslint-disable react-refresh/only-export-components */

import "@/styles/globals.css";
import { enableMapSet } from "immer";
import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {
  initYjs,
  showIndexedDBError,
  StorageErrorDialog,
  yjsManager,
  type StorageErrorType,
} from "./core/yjs";
import { useLorebookStore } from "./lib/lorebook";
import { usePresetStore } from "./lib/prompt";
import { useWorldStore } from "./lib/world";
import { registerAllModules } from "./modules";
import { initializeSessionStore } from "./stores";

// 启用 Immer 的 Map/Set 支持
enableMapSet();

/**
 * 错误页面组件
 * 当 Yjs 初始化失败时显示
 */
function ErrorPage({
  errorType,
  onRetry,
}: {
  errorType: StorageErrorType;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="dark min-h-screen bg-black flex items-center justify-center">
      <StorageErrorDialog
        open={open}
        errorType={errorType}
        onRetry={onRetry}
        onDismiss={() => setOpen(false)}
      />
      {/* 背景提示 */}
      {!open && (
        <div className="text-center text-gray-500">
          <p className="text-lg mb-4">游戏无法启动</p>
          <button
            onClick={() => setOpen(true)}
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            查看详情
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 渲染错误页面
 */
function renderErrorPage(errorType: StorageErrorType, onRetry: () => void) {
  const root = document.getElementById("root");
  if (!root) return;

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorPage errorType={errorType} onRetry={onRetry} />
    </React.StrictMode>,
  );
}

/**
 * 渲染主应用
 */
function renderApp() {
  const root = document.getElementById("root");
  if (!root) return;

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

/**
 * 开发模式：定期清理性能标记，避免 PerformanceEntry 在长时间运行中堆积
 */
function setupPerformanceEntryCleanup() {
  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return;
  }

  const maxEntries = 100;
  const cleanupIntervalMs = 5000;

  window.setInterval(() => {
    const measureCount = performance.getEntriesByType("measure").length;
    const markCount = performance.getEntriesByType("mark").length;

    if (measureCount > maxEntries || markCount > maxEntries) {
      console.warn(
        `[Performance] 清理性能标记: ${measureCount} measures, ${markCount} marks`,
      );
      performance.clearMeasures();
      performance.clearMarks();
    }
  }, cleanupIntervalMs);
}

// 初始化应用
async function bootstrap() {
  setupPerformanceEntryCleanup();

  // 1. 初始化 Yjs（包含 IndexedDB 可用性检查）
  const initResult = await initYjs();

  if (!initResult.success) {
    // 尝试使用 React 渲染错误页面
    try {
      renderErrorPage(initResult.errorType!, () => {
        // 重试：刷新页面
        window.location.reload();
      });
    } catch {
      // 降级：使用 alert
      showIndexedDBError(initResult.errorType);
    }
    return;
  }

  // 2. 挂载全局 API（方便控制台测试）
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).yjsManager = yjsManager;
  }

  // 3. 注册所有模块（命令处理器、事件处理器等）
  await registerAllModules();

  // 4. 初始化 Session 聚合 Store（幂等）
  initializeSessionStore();

  // 5. 初始化预设系统
  try {
    await usePresetStore.getState().loadPresets();
  } catch (error) {
    console.error("[Bootstrap] Failed to initialize preset store:", error);
    // 预设加载失败不阻塞应用启动，会在使用时提示用户
  }

  // 6. 初始化世界系统
  try {
    await useWorldStore.getState().initialize();
    await useWorldStore.getState().getActiveWorld();
  } catch (error) {
    console.error("[Bootstrap] Failed to initialize world store:", error);
    // 世界系统加载失败不阻塞应用启动
  }

  // 7. 初始化世界书系统
  try {
    await useLorebookStore.getState().initialize();
    // 预加载激活的世界书数据到缓存
    await useLorebookStore.getState().getActiveLorebooks();
  } catch (error) {
    console.error("[Bootstrap] Failed to initialize lorebook store:", error);
    // 世界书加载失败不阻塞应用启动
  }

  // 8. 渲染应用
  renderApp();
}

bootstrap().catch(() => {
  // Bootstrap failed silently
});
