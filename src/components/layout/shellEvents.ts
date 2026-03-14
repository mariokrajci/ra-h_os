import type { DatabaseEvent } from '@/services/events';

export interface ShellRefreshState {
  nodes: number;
  focus: number;
  folder: number;
  openLogEntry: boolean;
}

export interface ShellEventOptions {
  openLogEntry?: boolean;
}

export function createInitialShellRefreshState(): ShellRefreshState {
  return {
    nodes: 0,
    focus: 0,
    folder: 0,
    openLogEntry: false,
  };
}

export function reduceShellEvent(
  state: ShellRefreshState,
  event: DatabaseEvent,
  openTabs: number[],
  options: ShellEventOptions = {},
): ShellRefreshState {
  if (options.openLogEntry) {
    return {
      ...state,
      openLogEntry: true,
    };
  }

  switch (event.type) {
    case 'NODE_CREATED':
      return { ...state, nodes: state.nodes + 1 };
    case 'NODE_UPDATED': {
      const updatedNodeId = Number(event.data?.nodeId);
      return {
        ...state,
        nodes: state.nodes + 1,
        focus: openTabs.includes(updatedNodeId) ? state.focus + 1 : state.focus,
      };
    }
    case 'NODE_DELETED':
      return { ...state, nodes: state.nodes + 1, focus: state.focus + 1 };
    case 'EDGE_CREATED':
    case 'EDGE_DELETED': {
      const fromNodeId = Number(event.data?.fromNodeId);
      const toNodeId = Number(event.data?.toNodeId);
      const touchesOpenTab = openTabs.includes(fromNodeId) || openTabs.includes(toNodeId);
      return {
        ...state,
        focus: touchesOpenTab ? state.focus + 1 : state.focus,
      };
    }
    case 'DIMENSION_UPDATED':
      return {
        ...state,
        nodes: state.nodes + 1,
        folder: state.folder + 1,
      };
    default:
      return state;
  }
}
