import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppForegroundPermissionRecheck(
  checkGranted: () => Promise<boolean>,
  onGranted: () => void,
  enabled = true,
) {
  const checkRef = useRef(checkGranted);
  const onGrantedRef = useRef(onGranted);
  checkRef.current = checkGranted;
  onGrantedRef.current = onGranted;

  useEffect(() => {
    if (!enabled) return;

    const handleChange = async (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      const granted = await checkRef.current();
      if (granted) onGrantedRef.current();
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [enabled]);
}
