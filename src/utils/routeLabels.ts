import { Route } from '../data/types';

export function routeShapeLabel(route: Route): string {
  if (route.outAndBack) return 'Out & back';
  if (route.loop) return 'Loop';
  return 'One way';
}

export type RouteShapeFilter = 'any' | 'loop' | 'out_and_back' | 'one_way';

export function matchesShapeFilter(route: Route, filter: RouteShapeFilter): boolean {
  if (filter === 'loop') return route.loop === true;
  if (filter === 'out_and_back') return route.outAndBack === true;
  if (filter === 'one_way') return !route.loop && !route.outAndBack;
  return true;
}
