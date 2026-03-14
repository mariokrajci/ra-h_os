"use client";

import MobileShell from '@/components/mobile/MobileShell';
import TabletShell from '@/components/tablet/TabletShell';

import ThreePanelLayout from './ThreePanelLayout';
import { useLayoutMode } from './useLayoutMode';
import { getShellVariant } from './shellVariant';

export default function AppShell() {
  const layoutMode = useLayoutMode();
  const shellVariant = getShellVariant(layoutMode);

  if (shellVariant === 'mobile') {
    return <MobileShell />;
  }

  if (shellVariant === 'tablet') {
    return <TabletShell />;
  }

  return <ThreePanelLayout />;
}
