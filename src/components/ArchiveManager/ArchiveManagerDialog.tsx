import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { Dialog, DialogContent } from "@/components/ui";
import {
  WorldArchiveCommands,
  type CreateWorldArchiveEntityPayload,
  type EntityArchetype,
  type EntityPresence,
} from "@/domain/commands/world-archive";
import { useCommand } from "@/hooks";
import { useWorldArchiveStore, type NarrativeEntity } from "@/modules";
import { stepBackwardVariants, stepForwardVariants } from "@/styles/tokens";

import { ArchiveCreateDialog } from "./ArchiveCreateDialog";
import { ArchiveEntityDetail } from "./ArchiveEntityDetail";
import { ArchiveEntityList } from "./ArchiveEntityList";
import { useArchiveWorkspaceState } from "./hooks/useArchiveWorkspaceState";

const LG_BREAKPOINT = 1024;

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`).matches,
    () => true,
  );
}

interface ArchiveManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveManagerDialog({
  open,
  onOpenChange,
}: ArchiveManagerDialogProps) {
  const isDesktop = useIsDesktop();
  const entitiesMap = useWorldArchiveStore((state) => state.entities);
  const dispatch = useCommand();

  const workspace = useWorkspaceBridge();

  const entities = useMemo(() => {
    return Object.values(entitiesMap).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [entitiesMap]);

  const selectedEntity = useMemo(() => {
    if (!workspace.selectedEntityId) {
      return null;
    }
    return entitiesMap[workspace.selectedEntityId] ?? null;
  }, [entitiesMap, workspace.selectedEntityId]);

  useEffect(() => {
    if (!open) {
      workspace.reset();
      return;
    }

    if (!workspace.selectedEntityId && entities.length > 0) {
      workspace.selectEntity(entities[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workspace 动作在 useWorkspaceBridge 内通过 useCallback 稳定封装
  }, [
    entities,
    open,
    workspace.reset,
    workspace.selectEntity,
    workspace.selectedEntityId,
  ]);

  useEffect(() => {
    if (!workspace.selectedEntityId) {
      return;
    }

    if (!entitiesMap[workspace.selectedEntityId]) {
      workspace.clearSelection();
      workspace.goToList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workspace 动作在 useWorkspaceBridge 内通过 useCallback 稳定封装
  }, [
    entitiesMap,
    workspace.clearSelection,
    workspace.goToList,
    workspace.selectedEntityId,
  ]);

  const handleCreateEntity = async (
    payload: CreateWorldArchiveEntityPayload,
  ): Promise<string | null> => {
    const result = await dispatch<
      CreateWorldArchiveEntityPayload,
      { entityId: string }
    >({
      type: WorldArchiveCommands.CREATE_ENTITY,
      payload,
    });

    if (!result.success || !result.data?.entityId) {
      return null;
    }

    workspace.selectEntity(result.data.entityId);
    return result.data.entityId;
  };

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }
      }

      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        title="世界档案"
        description="管理叙事实体"
        width={isDesktop ? 1200 : "xl"}
        animateSize
        animateLifecycle
        className="max-h-[88vh]"
      >
        <div className="-m-4 h-[75vh] min-h-130">
          {isDesktop ? (
            <DesktopLayout
              entities={entities}
              selectedEntityId={workspace.selectedEntityId}
              selectedEntity={selectedEntity}
              searchKeyword={workspace.searchKeyword}
              filter={workspace.filter}
              onSearchKeywordChange={workspace.setSearchKeyword}
              onFilterChange={workspace.setFilter}
              onSelectEntity={workspace.selectEntity}
              onOpenCreateDialog={workspace.openCreateDialog}
            />
          ) : (
            <MobileLayout
              entities={entities}
              selectedEntityId={workspace.selectedEntityId}
              selectedEntity={selectedEntity}
              mobilePage={workspace.mobilePage}
              searchKeyword={workspace.searchKeyword}
              filter={workspace.filter}
              onSearchKeywordChange={workspace.setSearchKeyword}
              onFilterChange={workspace.setFilter}
              onSelectEntity={workspace.selectEntity}
              onBackToList={workspace.goToList}
              onOpenCreateDialog={workspace.openCreateDialog}
            />
          )}
        </div>

        <ArchiveCreateDialog
          open={workspace.createDialogOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              workspace.openCreateDialog();
            } else {
              workspace.closeCreateDialog();
            }
          }}
          onCreate={handleCreateEntity}
        />
      </DialogContent>
    </Dialog>
  );
}

interface SharedLayoutProps {
  entities: NarrativeEntity[];
  selectedEntityId: string | null;
  selectedEntity: NarrativeEntity | null;
  searchKeyword: string;
  filter: "all" | `presence:${EntityPresence}` | `archetype:${EntityArchetype}`;
  onSearchKeywordChange: (keyword: string) => void;
  onFilterChange: (
    filter:
      | "all"
      | `presence:${EntityPresence}`
      | `archetype:${EntityArchetype}`,
  ) => void;
  onSelectEntity: (entityId: string) => void;
  onOpenCreateDialog: () => void;
}

interface WorkspaceViewState {
  selectedEntityId: string | null;
  searchKeyword: string;
  filter: "all" | `presence:${EntityPresence}` | `archetype:${EntityArchetype}`;
  mobilePage: "list" | "detail";
  createDialogOpen: boolean;
}

interface WorkspaceViewActions {
  setSearchKeyword: (keyword: string) => void;
  setFilter: (
    filter:
      | "all"
      | `presence:${EntityPresence}`
      | `archetype:${EntityArchetype}`,
  ) => void;
  selectEntity: (entityId: string) => void;
  clearSelection: () => void;
  goToList: () => void;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  reset: () => void;
}

function useWorkspaceBridge(): WorkspaceViewState & WorkspaceViewActions {
  const workspace = useArchiveWorkspaceState();

  const setSearchKeyword = useCallback(
    (keyword: string) => {
      workspace.setSearchKeyword(keyword);
    },
    [workspace],
  );

  const setFilter = useCallback(
    (
      filter:
        | "all"
        | `presence:${EntityPresence}`
        | `archetype:${EntityArchetype}`,
    ) => {
      workspace.setFilter(filter);
    },
    [workspace],
  );

  const selectEntity = useCallback(
    (entityId: string) => {
      workspace.selectEntity(entityId);
    },
    [workspace],
  );

  const clearSelection = useCallback(() => {
    workspace.clearSelection();
  }, [workspace]);

  const goToList = useCallback(() => {
    workspace.goToList();
  }, [workspace]);

  const openCreateDialog = useCallback(() => {
    workspace.openCreateDialog();
  }, [workspace]);

  const closeCreateDialog = useCallback(() => {
    workspace.closeCreateDialog();
  }, [workspace]);

  const reset = useCallback(() => {
    workspace.reset();
  }, [workspace]);

  return {
    selectedEntityId: workspace.selectedEntityId,
    searchKeyword: workspace.searchKeyword,
    filter: workspace.filter,
    mobilePage: workspace.mobilePage,
    createDialogOpen: workspace.createDialogOpen,
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

function DesktopLayout({
  entities,
  selectedEntityId,
  selectedEntity,
  searchKeyword,
  filter,
  onSearchKeywordChange,
  onFilterChange,
  onSelectEntity,
  onOpenCreateDialog,
}: SharedLayoutProps) {
  return (
    <div className="flex h-full">
      <div className="w-84 shrink-0 border-r border-primary/20">
        <ArchiveEntityList
          entities={entities}
          selectedEntityId={selectedEntityId}
          searchKeyword={searchKeyword}
          filter={filter}
          onSearchKeywordChange={onSearchKeywordChange}
          onFilterChange={onFilterChange}
          onSelectEntity={onSelectEntity}
          onCreateEntity={onOpenCreateDialog}
        />
      </div>

      <div className="min-w-0 flex-1">
        <ArchiveEntityDetail entity={selectedEntity} entities={entities} />
      </div>
    </div>
  );
}

interface MobileLayoutProps extends SharedLayoutProps {
  mobilePage: "list" | "detail";
  onBackToList: () => void;
}

function MobileLayout({
  entities,
  selectedEntityId,
  selectedEntity,
  mobilePage,
  searchKeyword,
  filter,
  onSearchKeywordChange,
  onFilterChange,
  onSelectEntity,
  onBackToList,
  onOpenCreateDialog,
}: MobileLayoutProps) {
  return (
    <div className="h-full overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {mobilePage === "list" ? (
          <motion.div
            key="archive-list"
            className="h-full"
            variants={stepBackwardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <ArchiveEntityList
              entities={entities}
              selectedEntityId={selectedEntityId}
              searchKeyword={searchKeyword}
              filter={filter}
              onSearchKeywordChange={onSearchKeywordChange}
              onFilterChange={onFilterChange}
              onSelectEntity={onSelectEntity}
              onCreateEntity={onOpenCreateDialog}
            />
          </motion.div>
        ) : (
          <motion.div
            key="archive-detail"
            className="h-full"
            variants={stepForwardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <ArchiveEntityDetail
              entity={selectedEntity}
              entities={entities}
              onBack={onBackToList}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
