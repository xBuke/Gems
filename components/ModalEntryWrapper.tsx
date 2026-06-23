import { useReduceMotion } from '@/lib/ReduceMotionContext';
import { REDUCED_MOTION_DURATION_MS } from '@/lib/navigationMotion';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

type ModalEntryWrapperProps = {
  children: ReactNode;
};

export function ModalEntryWrapper({ children }: ModalEntryWrapperProps) {
  const reduceMotion = useReduceMotion();

  if (reduceMotion) {
    return (
      <Animated.View
        entering={FadeIn.duration(REDUCED_MOTION_DURATION_MS)}
        style={styles.container}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(24).stiffness(200)}
      style={styles.container}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
