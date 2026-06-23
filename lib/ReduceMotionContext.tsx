import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

type ReduceMotionContextValue = {
  reduceMotion: boolean;
};

const ReduceMotionContext = createContext<ReduceMotionContextValue>({ reduceMotion: false });

export function ReduceMotionProvider({ children }: { children: ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(enabled),
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <ReduceMotionContext.Provider value={{ reduceMotion }}>
      {children}
    </ReduceMotionContext.Provider>
  );
}

/** Single shared reduce-motion check for all navigation and custom animations. */
export function useReduceMotion() {
  return useContext(ReduceMotionContext).reduceMotion;
}
