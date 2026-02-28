/**
 * Director Zustand Store
 *
 * 管理导演模块在前端内存中的响应式状态。
 * 持久化由 DirectorRepository（Yjs）负责。
 */

import { create } from "zustand";

import { generateSortableId } from "@/domain/types";

import type {
  DirectorLogEntry,
  Foreshadow,
  Milestone,
  PlotOutline,
  StoryArc,
} from "./types";

const DIRECTOR_LOG_LIMIT = 100;

function cloneDirectorLogEntry(entry: DirectorLogEntry): DirectorLogEntry {
  return {
    turn: entry.turn,
    timestamp: entry.timestamp,
    plotDirectives: entry.plotDirectives,
    narrativeHints: entry.narrativeHints,
    archiveUpdatesSummary: entry.archiveUpdatesSummary,
    outlineUpdatesSummary: entry.outlineUpdatesSummary,
  };
}

function cloneForeshadow(foreshadow: Foreshadow): Foreshadow {
  return {
    id: foreshadow.id,
    description: foreshadow.description,
    plantedAtTurn: foreshadow.plantedAtTurn,
    triggerCondition: foreshadow.triggerCondition,
    revealEffect: foreshadow.revealEffect,
    status: foreshadow.status,
    hintCount: foreshadow.hintCount,
    relatedEntityIds: [...foreshadow.relatedEntityIds],
  };
}

function cloneMilestone(milestone: Milestone): Milestone {
  return {
    id: milestone.id,
    description: milestone.description,
    triggerConditions: milestone.triggerConditions,
    effects: milestone.effects,
    status: milestone.status,
  };
}

function cloneStoryArc(arc: StoryArc): StoryArc {
  return {
    id: arc.id,
    title: arc.title,
    premise: arc.premise,
    milestones: arc.milestones.map(cloneMilestone),
    involvedEntityIds: [...arc.involvedEntityIds],
    status: arc.status,
    deviations: [...arc.deviations],
  };
}

function clonePlotOutline(outline: PlotOutline): PlotOutline {
  return {
    currentArc: cloneStoryArc(outline.currentArc),
    completedArcs: outline.completedArcs.map(cloneStoryArc),
    plannedArcs: outline.plannedArcs.map(cloneStoryArc),
  };
}

function cloneForeshadows(
  foreshadows: Record<string, Foreshadow>,
): Record<string, Foreshadow> {
  const next: Record<string, Foreshadow> = {};

  Object.entries(foreshadows).forEach(([id, foreshadow]) => {
    next[id] = cloneForeshadow(foreshadow);
  });

  return next;
}

export interface DirectorState {
  // 剧情大纲
  outline: PlotOutline | null;

  // 伏笔库
  foreshadows: Record<string, Foreshadow>;

  // 导演决策日志（保留最近 N 条）
  directorLog: DirectorLogEntry[];

  // ── 大纲操作 ──
  setOutline(outline: PlotOutline): void;
  updateCurrentArc(updates: Partial<StoryArc>): void;

  // ── 伏笔操作 ──
  addForeshadow(foreshadow: Omit<Foreshadow, "id">): Foreshadow;
  updateForeshadow(id: string, updates: Partial<Omit<Foreshadow, "id">>): void;
  removeForeshadow(id: string): void;

  // ── 日志操作 ──
  appendDirectorLog(entry: DirectorLogEntry): void;

  // ── 内部方法（SyncBridge 用） ──
  _setAll(data: {
    outline: PlotOutline | null;
    foreshadows: Record<string, Foreshadow>;
    directorLog: DirectorLogEntry[];
  }): void;
  _clear(): void;
}

export const useDirectorStore = create<DirectorState>((set) => ({
  outline: null,
  foreshadows: {},
  directorLog: [],

  setOutline: (outline) => {
    set({ outline: clonePlotOutline(outline) });
  },

  updateCurrentArc: (updates) => {
    set((state) => {
      if (!state.outline) {
        return state;
      }

      const nextCurrentArc: StoryArc = {
        ...state.outline.currentArc,
        ...updates,
        milestones: updates.milestones
          ? updates.milestones.map(cloneMilestone)
          : state.outline.currentArc.milestones.map(cloneMilestone),
        involvedEntityIds: updates.involvedEntityIds
          ? [...updates.involvedEntityIds]
          : [...state.outline.currentArc.involvedEntityIds],
        deviations: updates.deviations
          ? [...updates.deviations]
          : [...state.outline.currentArc.deviations],
      };

      return {
        outline: {
          ...state.outline,
          currentArc: nextCurrentArc,
          completedArcs: state.outline.completedArcs.map(cloneStoryArc),
          plannedArcs: state.outline.plannedArcs.map(cloneStoryArc),
        },
      };
    });
  },

  addForeshadow: (foreshadow) => {
    const created: Foreshadow = {
      ...foreshadow,
      id: generateSortableId(),
      relatedEntityIds: [...foreshadow.relatedEntityIds],
    };

    set((state) => ({
      foreshadows: {
        ...state.foreshadows,
        [created.id]: created,
      },
    }));

    return created;
  },

  updateForeshadow: (id, updates) => {
    set((state) => {
      const existed = state.foreshadows[id];
      if (!existed) {
        return state;
      }

      const next: Foreshadow = {
        ...existed,
        ...updates,
        relatedEntityIds: updates.relatedEntityIds
          ? [...updates.relatedEntityIds]
          : [...existed.relatedEntityIds],
      };

      return {
        foreshadows: {
          ...state.foreshadows,
          [id]: next,
        },
      };
    });
  },

  removeForeshadow: (id) => {
    set((state) => {
      if (!state.foreshadows[id]) {
        return state;
      }

      const next = { ...state.foreshadows };
      delete next[id];

      return {
        foreshadows: next,
      };
    });
  },

  appendDirectorLog: (entry) => {
    set((state) => {
      const nextLog = [...state.directorLog, cloneDirectorLogEntry(entry)];
      const trimmedLog =
        nextLog.length > DIRECTOR_LOG_LIMIT
          ? nextLog.slice(-DIRECTOR_LOG_LIMIT)
          : nextLog;

      return {
        directorLog: trimmedLog,
      };
    });
  },

  _setAll: ({ outline, foreshadows, directorLog }) => {
    const nextDirectorLog = directorLog
      .map(cloneDirectorLogEntry)
      .slice(-DIRECTOR_LOG_LIMIT);

    set({
      outline: outline ? clonePlotOutline(outline) : null,
      foreshadows: cloneForeshadows(foreshadows),
      directorLog: nextDirectorLog,
    });
  },

  _clear: () => {
    set({
      outline: null,
      foreshadows: {},
      directorLog: [],
    });
  },
}));
