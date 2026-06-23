import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation, useRouter, type Router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';

export const REDUCED_MOTION_DURATION_MS = 150;
export const TAB_CROSSFADE_DURATION_MS = 200;
export const STACK_PUSH_DURATION_MS = 300;
export const SHARED_ELEMENT_DURATION_MS = 350;

export const TAB_ROUTES = ['index', 'map', 'notifications', 'profile'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

const TAB_PATHS: Record<TabRoute, '/' | '/map' | '/notifications' | '/profile'> = {
  index: '/',
  map: '/map',
  notifications: '/notifications',
  profile: '/profile',
};

export function getStackPushOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  if (reduceMotion) {
    return {
      animation: 'fade',
      animationDuration: REDUCED_MOTION_DURATION_MS,
    };
  }

  return {
    animation: 'slide_from_right',
    animationDuration: STACK_PUSH_DURATION_MS,
  };
}

export function getTabScreenOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  if (reduceMotion) {
    return {
      animation: 'fade',
      animationDuration: REDUCED_MOTION_DURATION_MS,
      animationTypeForReplace: 'push',
    };
  }

  return {
    animation: 'fade',
    animationDuration: TAB_CROSSFADE_DURATION_MS,
    animationTypeForReplace: 'push',
  };
}

export function getModalScreenOptions(reduceMotion: boolean): NativeStackNavigationOptions {
  if (reduceMotion) {
    return {
      presentation: 'modal',
      headerShown: false,
      animation: 'fade',
      animationDuration: REDUCED_MOTION_DURATION_MS,
    };
  }

  // Native stack animation is disabled; ModalEntryWrapper applies the spring slide-up.
  return {
    presentation: 'modal',
    headerShown: false,
    animation: 'none',
  };
}

export function navigateToTab(router: Router, tab: TabRoute) {
  router.replace(TAB_PATHS[tab]);
}

/** Use when a screen may be a tab root (replaced, no stack history) but still has a "back" affordance. */
export function goBackOrTab(router: Router, fallback: TabRoute = 'index') {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  navigateToTab(router, fallback);
}

/**
 * Disable iOS edge-swipe back when there is no stack history (tab root via replace).
 */
export function useTabStackGesture(router: Router) {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ gestureEnabled: router.canGoBack() });
    }, [navigation, router]),
  );
}

/**
 * On Android, intercept hardware back when there is no stack history (tab root via replace)
 * and navigate to the fallback tab instead of dispatching a no-op GO_BACK.
 */
export function useTabRootBackHandler(active: boolean, fallback: TabRoute = 'index') {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        return false;
      }
      navigateToTab(router, fallback);
      return true;
    });

    return () => subscription.remove();
  }, [active, fallback, router]);
}
