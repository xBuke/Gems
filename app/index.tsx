import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#0A2E1F',
  active: '#1D9E75',
  white: '#FFFFFF',
  subtitle: '#A8D5BA',
  photoPlaceholder: '#1D9E75',
  inactiveBorder: '#FFFFFF',
  searchPlaceholder: '#888888',
  cardBadge: '#1D9E75',
  star: '#F5C518',
  muted: '#B0C4B8',
};

const CATEGORIES = ['All', 'Beach', 'Graffiti', 'Viewpoint', 'Food', 'Skate', 'Nature'] as const;

const GEMS = [
  { id: '1', name: 'Secret Cove Beach', category: 'Beach', rating: '4.8', distance: '1.2 km' },
  { id: '2', name: 'Rooftop Mural Lookout', category: 'Viewpoint', rating: '4.8', distance: '1.2 km' },
  { id: '3', name: 'Hidden Waterfall Mostar', category: 'Nature', rating: '4.9', distance: '45 km' },
];

const TABS = [
  { key: 'map', label: 'Map', icon: 'map-outline' as const, activeIcon: 'map' as const },
  { key: 'add', label: 'Add', icon: 'add-circle-outline' as const, activeIcon: 'add-circle' as const },
  { key: 'messages', label: 'Messages', icon: 'chatbubble-outline' as const, activeIcon: 'chatbubble' as const },
  { key: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
];

export default function HomeScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<string>('map');
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
                <Ionicons name="person-circle-outline" size={28} color={COLORS.white} />
              ) : (
                <Text style={styles.loginButton}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Discover secret places near you</Text>

          <TextInput
            style={styles.searchBar}
            placeholder="Search hidden gems..."
            placeholderTextColor={COLORS.searchPlaceholder}
          />

          <TouchableOpacity
            style={styles.gemOfTheDayCard}
            onPress={() => console.log('Gem of the day')}
            activeOpacity={0.7}>
            <Ionicons name="location" size={28} color="#1D9E75" />
            <View style={styles.gemOfTheDayContent}>
              <Text style={styles.gemOfTheDayLabel}>GEM OF THE DAY</Text>
              <Text style={styles.gemOfTheDayName}>Stiniva Beach, Vis</Text>
              <Text style={styles.gemOfTheDayMeta}>87 km away · Beach</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#1D9E75" />
          </TouchableOpacity>

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

        <View style={styles.gemsList}>
          {GEMS.map((gem) => (
            <View key={gem.id} style={styles.gemCard}>
              <View style={styles.photoPlaceholder}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{gem.category}</Text>
                </View>
              </View>
              <View style={styles.gemInfo}>
                <Text style={styles.gemName}>{gem.name}</Text>
                <View style={styles.gemMeta}>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>{gem.rating}</Text>
                  </View>
                  <View style={styles.distanceRow}>
                    <Ionicons name="location-outline" size={14} color="#A8D5BA" />
                    <Text style={styles.distanceText}>{gem.distance}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
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
                color={isActive ? COLORS.active : COLORS.muted}
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
    backgroundColor: COLORS.background,
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
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
  },
  loginButton: {
    fontSize: 13,
    color: '#1D9E75',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.subtitle,
    marginTop: 4,
    marginBottom: 20,
  },
  searchBar: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    marginBottom: 20,
  },
  gemOfTheDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F3D25',
    borderWidth: 1,
    borderColor: '#1D9E75',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 12,
  },
  gemOfTheDayContent: {
    flex: 1,
  },
  gemOfTheDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D9E75',
  },
  gemOfTheDayName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gemOfTheDayMeta: {
    fontSize: 12,
    color: '#A8D5BA',
  },
  categoryRow: {
    gap: 10,
    paddingBottom: 4,
    marginBottom: 24,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.inactiveBorder,
    backgroundColor: COLORS.background,
  },
  categoryPillActive: {
    backgroundColor: COLORS.active,
    borderColor: COLORS.active,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 16,
  },
  gemCard: {
    backgroundColor: '#0F3D25',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  photoPlaceholder: {
    height: 140,
    width: '100%',
    backgroundColor: '#1A5C3A',
  },
  gemInfo: {
    padding: 12,
  },
  gemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
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
    backgroundColor: '#1D9E75',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#A8D5BA',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
    color: '#A8D5BA',
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: COLORS.background,
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
    color: COLORS.muted,
  },
  tabLabelActive: {
    color: COLORS.active,
    fontWeight: '600',
  },
});
