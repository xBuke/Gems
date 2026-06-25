export type MapGemLike = {
  id: string;
  title: string;
  image_url?: string | null;
  likeCount: number;
};

type SuperclusterLeaf = {
  properties: {
    index: number;
  };
};

/** Pick the cover photo from the highest-liked gem in a cluster (uses gems.image_url). */
export function pickMostLikedThumbnail(gems: MapGemLike[]): string | null {
  if (gems.length === 0) return null;
  const top = [...gems].sort((a, b) => b.likeCount - a.likeCount)[0];
  return top.image_url ?? null;
}

export function resolveGemsFromClusterLeaves<T extends MapGemLike>(
  leaves: SuperclusterLeaf[] | undefined,
  markerGems: T[],
): T[] {
  if (!leaves?.length) return [];

  const seen = new Set<string>();
  const gems: T[] = [];

  for (const leaf of leaves) {
    const gem = markerGems[leaf.properties.index];
    if (!gem || seen.has(gem.id)) continue;
    seen.add(gem.id);
    gems.push(gem);
  }

  return gems;
}
