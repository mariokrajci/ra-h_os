"use client";

import { useEffect, useState } from 'react';

import { getLayoutMode, type LayoutMode } from './layoutMode';

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return getLayoutMode(window.innerWidth);
  });

  useEffect(() => {
    const updateMode = () => setMode(getLayoutMode(window.innerWidth));

    updateMode();
    window.addEventListener('resize', updateMode);
    return () => window.removeEventListener('resize', updateMode);
  }, []);

  return mode;
}
