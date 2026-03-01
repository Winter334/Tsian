import { useCallback, useState } from "react";

import type { EntityArchetype, EntityPresence } from "@/modules";

export type ArchiveListFilter =
  | "all"
  | `presence:${EntityPresence}`
  | `archetype:${EntityArchetype}`;

export type ArchiveMobilePage = "list" | "detail";

export interface ArchiveWorkspaceState {
  selectedEntityId: string | null;
  searchKeyword: string;
  filter: ArchiveListFilter;
  mobilePage: ArchiveMobilePage;
  createDialogOpen: boolean;
}

export interface ArchiveWorkspaceActions {
  setSearchKeyword: (keyword: string) => void;
  setFilter: (filter: ArchiveListFilter) => void;
  selectEntity: (entityId: string) => void;
  clearSelection: () => void;
  goToList: () => void;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  reset: () => void;
}

export function useArchiveWorkspaceState(): ArchiveWorkspaceState &
  ArchiveWorkspaceActions {
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filter, setFilter] = useState<ArchiveListFilter>("all");
  const [mobilePage, setMobilePage] = useState<ArchiveMobilePage>("list");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const selectEntity = useCallback((entityId: string) => {
    setSelectedEntityId(entityId);
    setMobilePage("detail");
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEntityId(null);
  }, []);

  const goToList = useCallback(() => {
    setMobilePage("list");
  }, []);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const reset = useCallback(() => {
    setSelectedEntityId(null);
    setSearchKeyword("");
    setFilter("all");
    setMobilePage("list");
    setCreateDialogOpen(false);
  }, []);

  return {
    selectedEntityId,
    searchKeyword,
    filter,
    mobilePage,
    createDialogOpen,
    setSearchKeyword,
    setFilter,
    selectEntity,
    clearSelection,
    goToList,
    openCreateDialog,
    closeCreateDialog,
    reset,
  };
}
