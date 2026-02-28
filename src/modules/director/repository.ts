/**
 * Director Repository - 封装导演模块的 Yjs 持久化读写
 */

import * as Y from "yjs";

import { yjsManager } from "@/core/yjs/manager";

import type { DirectorLogEntry, Foreshadow, PlotOutline } from "./types";

const PLOT_DATA_KEY = "plotData";
const OUTLINE_KEY = "outline";
const OUTLINE_DATA_KEY = "data";
const FORESHADOWS_KEY = "foreshadows";
const DIRECTOR_LOG_KEY = "directorLog";
const DIRECTOR_LOG_ENTRIES_KEY = "entries";

export class DirectorRepository {
  private plotDataMap: Y.Map<unknown>;

  constructor(private saveDoc: Y.Map<unknown>) {
    this.plotDataMap = this.ensureStructure();
  }

  /**
   * 惰性创建 plotData 结构
   *
   * plotData (Y.Map)
   *   ├── outline (Y.Map)
   *   │   └── data (string)              // JSON.stringify(PlotOutline)
   *   ├── foreshadows (Y.Map<id, string>)// JSON.stringify(Foreshadow)
   *   └── directorLog (Y.Map)
   *       └── entries (string)           // JSON.stringify(DirectorLogEntry[])
   *                                       // 注：文档曾描述为 Array<DirectorLogEntry 的 JSON 字符串>，
   *                                       // 这里统一采用“整个数组一次 JSON 序列化”的单字符串存储，
   *                                       // 读写更简单，且与当前实现保持一致。
   */
  ensureStructure(): Y.Map<unknown> {
    let plotData = this.saveDoc.get(PLOT_DATA_KEY) as
      | Y.Map<unknown>
      | undefined;

    if (!plotData) {
      plotData = new Y.Map<unknown>();
      this.saveDoc.set(PLOT_DATA_KEY, plotData);
    }

    let outline = plotData.get(OUTLINE_KEY) as Y.Map<unknown> | undefined;
    if (!outline) {
      outline = new Y.Map<unknown>();
      plotData.set(OUTLINE_KEY, outline);
    }

    if (!outline.has(OUTLINE_DATA_KEY)) {
      outline.set(OUTLINE_DATA_KEY, "");
    }

    if (!plotData.has(FORESHADOWS_KEY)) {
      plotData.set(FORESHADOWS_KEY, new Y.Map<string>());
    }

    let directorLog = plotData.get(DIRECTOR_LOG_KEY) as
      | Y.Map<unknown>
      | undefined;
    if (!directorLog) {
      directorLog = new Y.Map<unknown>();
      plotData.set(DIRECTOR_LOG_KEY, directorLog);
    }

    if (!directorLog.has(DIRECTOR_LOG_ENTRIES_KEY)) {
      directorLog.set(DIRECTOR_LOG_ENTRIES_KEY, "[]");
    }

    return plotData;
  }

  private getOutlineMap(): Y.Map<unknown> {
    return this.plotDataMap.get(OUTLINE_KEY) as Y.Map<unknown>;
  }

  private getForeshadowsMap(): Y.Map<string> {
    return this.plotDataMap.get(FORESHADOWS_KEY) as Y.Map<string>;
  }

  private getDirectorLogMap(): Y.Map<unknown> {
    return this.plotDataMap.get(DIRECTOR_LOG_KEY) as Y.Map<unknown>;
  }

  getOutline(): PlotOutline | null {
    const outlineMap = this.getOutlineMap();
    const raw = outlineMap.get(OUTLINE_DATA_KEY) as string | undefined;

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as PlotOutline;
    } catch {
      return null;
    }
  }

  saveOutline(outline: PlotOutline): void {
    const outlineMap = this.getOutlineMap();
    outlineMap.set(OUTLINE_DATA_KEY, JSON.stringify(outline));
  }

  getAllForeshadows(): Record<string, Foreshadow> {
    const foreshadowsMap = this.getForeshadowsMap();
    const foreshadows: Record<string, Foreshadow> = {};

    foreshadowsMap.forEach((rawValue, foreshadowId) => {
      try {
        const parsed = JSON.parse(rawValue) as Foreshadow;
        foreshadows[foreshadowId] = parsed;
      } catch {
        // 忽略损坏数据，保持读取过程健壮
      }
    });

    return foreshadows;
  }

  saveForeshadow(foreshadow: Foreshadow): void {
    const foreshadowsMap = this.getForeshadowsMap();
    foreshadowsMap.set(foreshadow.id, JSON.stringify(foreshadow));
  }

  deleteForeshadow(id: string): void {
    const foreshadowsMap = this.getForeshadowsMap();
    foreshadowsMap.delete(id);
  }

  getDirectorLog(): DirectorLogEntry[] {
    const directorLogMap = this.getDirectorLogMap();
    const raw = directorLogMap.get(DIRECTOR_LOG_ENTRIES_KEY) as
      | string
      | undefined;

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as DirectorLogEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveDirectorLog(entries: DirectorLogEntry[]): void {
    const directorLogMap = this.getDirectorLogMap();
    directorLogMap.set(DIRECTOR_LOG_ENTRIES_KEY, JSON.stringify(entries));
  }
}

let currentRepository: DirectorRepository | null = null;
let currentSaveId: string | null = null;

export function getDirectorRepository(): DirectorRepository {
  const saveId = yjsManager.getCurrentSaveId();

  if (!saveId) {
    throw new Error(
      "[DirectorRepository] No save loaded. Please load a save first.",
    );
  }

  const saveDoc = yjsManager.getCurrentSave();

  if (!saveDoc) {
    throw new Error("[DirectorRepository] Failed to get save document.");
  }

  if (saveId !== currentSaveId || !currentRepository) {
    currentRepository = new DirectorRepository(saveDoc);
    currentSaveId = saveId;
  }

  return currentRepository;
}

export function resetDirectorRepository(): void {
  currentRepository = null;
  currentSaveId = null;
}
