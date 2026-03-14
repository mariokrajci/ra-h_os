export type MobileRoute =
  | { screen: 'notes' }
  | { screen: 'detail'; nodeId: number }
  | { screen: 'child'; nodeId: number; child: 'source' | 'metadata' | 'connections' }
  | { screen: 'search' }
  | { screen: 'add' };

export type MobileRouteAction =
  | { type: 'open-note'; nodeId: number }
  | { type: 'open-child'; child: 'source' | 'metadata' | 'connections' }
  | { type: 'open-search' }
  | { type: 'open-add' }
  | { type: 'back' };

export function reduceMobileRoute(route: MobileRoute, action: MobileRouteAction): MobileRoute {
  switch (action.type) {
    case 'open-note':
      return { screen: 'detail', nodeId: action.nodeId };
    case 'open-child':
      if (route.screen === 'detail' || route.screen === 'child') {
        return { screen: 'child', nodeId: route.nodeId, child: action.child };
      }
      return route;
    case 'open-search':
      return { screen: 'search' };
    case 'open-add':
      return { screen: 'add' };
    case 'back':
      if (route.screen === 'child') {
        return { screen: 'detail', nodeId: route.nodeId };
      }
      return { screen: 'notes' };
    default:
      return route;
  }
}
