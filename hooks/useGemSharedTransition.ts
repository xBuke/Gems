import {
  clearPendingGemTransitionOrigin,
  getPendingGemTransitionOrigin,
  measureElementLayout,
  type ElementLayout,
  type GemSharedTransitionOrigin,
  type MeasurableRef,
} from '@/lib/gemSharedTransition';
import { SHARED_ELEMENT_DURATION_MS } from '@/lib/navigationMotion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';
import { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

function interpolateLayout(from: ElementLayout, to: ElementLayout, progress: number): ElementLayout {
  'worklet';
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

export function useGemSharedTransition(active: boolean) {
  const originRef = useRef<GemSharedTransitionOrigin | null>(null);
  const pendingBackCallbackRef = useRef<(() => void) | null>(null);
  const imageDestRef = useRef<View>(null);
  const titleDestRef = useRef<View>(null);
  const [transitionOrigin, setTransitionOrigin] = useState<GemSharedTransitionOrigin | null>(null);
  const [isAnimating, setIsAnimating] = useState(active);
  const [showFlyingLayer, setShowFlyingLayer] = useState(active);
  const progress = useSharedValue(active ? 0 : 1);
  const originImage = useSharedValue<ElementLayout | null>(null);
  const originTitle = useSharedValue<ElementLayout | null>(null);
  const destImage = useSharedValue<ElementLayout | null>(null);
  const destTitle = useSharedValue<ElementLayout | null>(null);

  useEffect(() => {
    if (!active) return;
    const origin = getPendingGemTransitionOrigin();
    originRef.current = origin;
    setTransitionOrigin(origin);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    return () => {
      pendingBackCallbackRef.current = null;
      clearPendingGemTransitionOrigin();
    };
  }, [active]);

  // Pop the route only after React has unmounted the flying overlay.
  useEffect(() => {
    if (showFlyingLayer || !pendingBackCallbackRef.current) return;
    const callback = pendingBackCallbackRef.current;
    pendingBackCallbackRef.current = null;
    callback();
  }, [showFlyingLayer]);

  const finishForwardAnimation = useCallback(() => {
    setIsAnimating(false);
    setShowFlyingLayer(false);
  }, []);

  const runForwardAnimation = useCallback(async () => {
    const origin = originRef.current;
    if (!origin) {
      finishForwardAnimation();
      return;
    }

    const [imageLayout, titleLayout] = await Promise.all([
      measureElementLayout(imageDestRef),
      measureElementLayout(titleDestRef),
    ]);

    if (!imageLayout || !titleLayout) {
      finishForwardAnimation();
      return;
    }

    originImage.value = origin.image;
    originTitle.value = origin.titleLayout;
    destImage.value = imageLayout;
    destTitle.value = titleLayout;

    progress.value = withTiming(
      1,
      {
        duration: SHARED_ELEMENT_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishForwardAnimation)();
        }
      },
    );
  }, [destImage, destTitle, finishForwardAnimation, originImage, originTitle, progress]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      runForwardAnimation();
    });
    return () => cancelAnimationFrame(frame);
  }, [active, runForwardAnimation]);

  const flyingImageStyle = useAnimatedStyle(() => {
    const from = originImage.value;
    const to = destImage.value;
    if (!from || !to) {
      return { opacity: 0 };
    }

    const layout = interpolateLayout(from, to, progress.value);
    return {
      position: 'absolute',
      left: layout.x,
      top: layout.y,
      width: layout.width,
      height: layout.height,
      opacity: 1,
      zIndex: 20,
    };
  });

  const flyingTitleStyle = useAnimatedStyle(() => {
    const from = originTitle.value;
    const to = destTitle.value;
    if (!from || !to) {
      return { opacity: 0 };
    }

    const layout = interpolateLayout(from, to, progress.value);
    return {
      position: 'absolute',
      left: layout.x,
      top: layout.y,
      width: layout.width,
      height: layout.height,
      opacity: 1,
      zIndex: 21,
    };
  });

  const runBackTransition = useCallback(
    (onComplete: () => void) => {
      const origin = originRef.current ?? getPendingGemTransitionOrigin();
      if (!origin || !destImage.value || !destTitle.value) {
        clearPendingGemTransitionOrigin();
        setTransitionOrigin(null);
        setShowFlyingLayer(false);
        onComplete();
        return;
      }

      setTransitionOrigin(origin);
      setShowFlyingLayer(true);
      setIsAnimating(true);
      originImage.value = origin.image;
      originTitle.value = origin.titleLayout;

      progress.value = withTiming(
        0,
        {
          duration: SHARED_ELEMENT_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        },
        (finished) => {
          if (finished) {
            runOnJS(() => {
              clearPendingGemTransitionOrigin();
              pendingBackCallbackRef.current = onComplete;
              setTransitionOrigin(null);
              setShowFlyingLayer(false);
            })();
          }
        },
      );
    },
    [destImage, destTitle, originImage, originTitle, progress],
  );

  return {
    imageDestRef,
    titleDestRef,
    isAnimating,
    showFlyingLayer,
    flyingImageStyle,
    flyingTitleStyle,
    origin: transitionOrigin,
    runBackTransition,
  };
}
