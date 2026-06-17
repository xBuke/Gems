import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  bg: '#0D0D0D',
  card: '#141414',
  accent: '#1D9E75',
  accentSubtle: '#0F3D25',
  text: '#F5F5F5',
  textMuted: '#888888',
  textDim: '#555555',
  border: '#222222',
  star: '#FFD700',
};

const CATEGORIES = ['All', 'Beach', 'Graffiti', 'Viewpoint', 'Food', 'Skate', 'Nature'] as const;

type Gem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  rating_avg: number | null;
  image_url: string | null;
};

const TABS = [
  { key: 'map', label: 'Map', icon: 'map-outline' as const, activeIcon: 'map' as const },
  { key: 'add', label: 'Add', icon: 'add-circle-outline' as const, activeIcon: 'add-circle' as const },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-outline' as const, activeIcon: 'chatbubble' as const },
  { key: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
];

export default function HomeScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [allGems, setAllGems] = useState<Gem[]>([]);
  const [filteredGems, setFilteredGems] = useState<Gem[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<string>('map');
  const [hasSession, setHasSession] = useState(false);
  const [gemOfTheDay, setGemOfTheDay] = useState<Gem | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchGemOfTheDay = async () => {
      const { data } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false)
        .limit(10);

      if (data && data.length > 0) {
        const random = data[Math.floor(Math.random() * data.length)];
        setGemOfTheDay(random);
      }
    };

    fetchGemOfTheDay();
  }, []);

  useEffect(() => {
    const fetchAllGems = async () => {
      const { data } = await supabase
        .from('gems')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: false });

      if (data) {
        setAllGems(data);
        setFilteredGems(data);
      }
    };

    fetchAllGems();
  }, []);

  useEffect(() => {
    let results = allGems;

    if (activeCategory !== 'All') {
      results = results.filter((g) => g.category === activeCategory);
    }

    if (searchQuery.trim() !== '') {
      results = results.filter(
        (g) =>
          g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredGems(results);
  }, [searchQuery, activeCategory, allGems]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <ScrollView
          style={styles.headerScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Hidden Gems</Text>
            <TouchableOpacity onPress={() => router.push('/auth')} activeOpacity={0.7}>
              {hasSession ? (
                <Ionicons name="person-circle-outline" size={28} color={COLORS.text} />
              ) : (
                <Text style={styles.loginButton}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Discover secret places near you</Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchBar}
              placeholder="Search hidden gems..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
                activeOpacity={0.7}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {gemOfTheDay && (
            <TouchableOpacity
              style={styles.gemOfTheDayCard}
              onPress={() => router.push('/gem/' + gemOfTheDay.id)}
              activeOpacity={0.7}>
              <Ionicons name="location" size={24} color={COLORS.accent} />
              <View style={styles.gemOfTheDayContent}>
                <Text style={styles.gemOfTheDayLabel}>GEM OF THE DAY</Text>
                <Text style={styles.gemOfTheDayName}>
                  {gemOfTheDay?.title || 'No gems yet'}
                </Text>
                <Text style={styles.gemOfTheDayMeta}>
                  {gemOfTheDay?.category + ' · Tap to explore'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                  onPress={() => setActiveCategory(category)}
                  activeOpacity={0.7}>
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>Gems near you</Text>
        </ScrollView>

        <ScrollView style={styles.gemsList} showsVerticalScrollIndicator={false}>
          {filteredGems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No gems found</Text>
              {searchQuery.trim() !== '' && (
                <Text style={styles.emptySubtext}>Try a different search</Text>
              )}
              {searchQuery.trim() === '' && activeCategory !== 'All' && (
                <Text style={styles.emptySubtext}>No gems in this category yet</Text>
              )}
            </View>
          ) : (
            filteredGems.map((gem) => (
              <TouchableOpacity
                key={gem.id}
                style={styles.gemCard}
                onPress={() => router.push('/gem/' + gem.id)}
                activeOpacity={0.7}>
                <View style={styles.photoPlaceholder}>
                  {gem.image_url ? (
                    <Image source={{ uri: gem.image_url }} style={styles.gemImage} />
                  ) : null}
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{gem.category}</Text>
                  </View>
                </View>
                <View style={styles.gemInfo}>
                  <Text style={styles.gemName}>{gem.title}</Text>
                  <View style={styles.gemMeta}>
                    {gem.rating_avg != null && (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color={COLORS.star} />
                        <Text style={styles.ratingText}>{gem.rating_avg.toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => {
                if (tab.key === 'map') {
                  router.push('/map');
                } else if (tab.key === 'add') {
                  router.push('/add-gem');
                } else if (tab.key === 'messages') {
                  router.push('/messages');
                } else if (tab.key === 'profile') {
                  router.push('/profile');
                }
                setActiveTab(tab.key);
              }}
              activeOpacity={0.7}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={24}
                color={isActive ? COLORS.accent : COLORS.textDim}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
  },
  headerScroll: {
    flexGrow: 0,
  },
  gemsList: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
  },
  loginButton: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 40,
    fontSize: 14,
    color: COLORS.text,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  gemOfTheDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  gemOfTheDayContent: {
    flex: 1,
  },
  gemOfTheDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gemOfTheDayName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  gemOfTheDayMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 4,
    marginBottom: 24,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSubtle,
  },
  categoryPillActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.accent,
  },
  categoryTextActive: {
    color: COLORS.bg,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  gemCard: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  photoPlaceholder: {
    height: 130,
    width: '100%',
    backgroundColor: '#1A1A1A',
  },
  gemImage: {
    height: 130,
    width: '100%',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  gemInfo: {
    padding: 12,
  },
  gemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  gemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: COLORS.accentSubtle,
    borderWidth: 0.5,
    borderColor: COLORS.accent,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingBottom: 8,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.textDim,
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
});
