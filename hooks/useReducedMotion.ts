'use client';

import { useEffect } from 'react';
import { useObservatory } from '@/lib/store';

export function useReducedMotion(): boolean {
  const reducedMotion = useObservatory((s) => s.reducedMotion);
  const setReducedMotion = useObservatory((s) => s.setReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [setReducedMotion]);

  return reducedMotion;
}
