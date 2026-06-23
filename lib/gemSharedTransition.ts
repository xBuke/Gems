import type { Router } from 'expo-router';
import type { RefObject } from 'react';
import type { Text, View } from 'react-native';

export type MeasurableRef = RefObject<View | Text | null>;

export type ElementLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GemSharedTransitionOrigin = {
  gemId: string;
  imageUrl: string | null;
  title: string;
  image: ElementLayout;
  titleLayout: ElementLayout;
};

let pendingOrigin: GemSharedTransitionOrigin | null = null;

export function getPendingGemTransitionOrigin() {
  return pendingOrigin;
}

export function clearPendingGemTransitionOrigin() {
  pendingOrigin = null;
}

export function measureElementLayout(ref: MeasurableRef): Promise<ElementLayout | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

type DiscoverGem = {
  id: string;
  title: string;
  image_url: string | null;
};

type DiscoverGemRefs = {
  imageRef: MeasurableRef;
  titleRef: MeasurableRef;
};

export async function navigateToGemFromDiscover(
  router: Router,
  gem: DiscoverGem,
  refs: DiscoverGemRefs,
  reduceMotion: boolean,
) {
  if (reduceMotion) {
    clearPendingGemTransitionOrigin();
    router.push({ pathname: '/gem/[id]', params: { id: gem.id } });
    return;
  }

  const [image, titleLayout] = await Promise.all([
    measureElementLayout(refs.imageRef),
    measureElementLayout(refs.titleRef),
  ]);

  if (!image || !titleLayout) {
    clearPendingGemTransitionOrigin();
    router.push({ pathname: '/gem/[id]', params: { id: gem.id } });
    return;
  }

  pendingOrigin = {
    gemId: gem.id,
    imageUrl: gem.image_url,
    title: gem.title,
    image,
    titleLayout,
  };

  router.push({
    pathname: '/gem/[id]',
    params: { id: gem.id, st: '1' },
  });
}

export function shouldRunGemSharedTransition(
  gemId: string | undefined,
  sharedTransitionFlag: string | string[] | undefined,
  reduceMotion: boolean,
) {
  if (reduceMotion || sharedTransitionFlag !== '1' || !gemId) return false;
  const origin = getPendingGemTransitionOrigin();
  return origin?.gemId === gemId;
}
