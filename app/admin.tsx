import { CATEGORIES } from '@/lib/categories';
import { useTheme } from '@/lib/ThemeContext';
import type { Theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AdminTab = 'overview' | 'users' | 'reports' | 'gems' | 'communities';
type ReportFilter = 'all' | 'pending' | 'resolved' | 'dismissed';

type Profile = {
  id: string;
  username: string | null;
  email?: string | null;
  is_premium: boolean;
  is_admin: boolean;
  is_banned?: boolean;
  premium_tier: string | null;
  created_at: string;
  home_town?: string | null;
  is_private?: boolean;
  last_active_date?: string | null;
  current_streak?: number;
  [key: string]: unknown;
};

type Report = {
  id: string;
  target_type: 'gem' | 'comment' | 'message' | 'user';
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: { username: string } | null;
};

type GemRow = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
  likesCount: number;
};

type CommunityRow = {
  id: string;
  name: string;
  created_at: string;
  creator_id: string;
  creator: { username: string } | null;
  memberCount: number;
};

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'reports', label: 'Reports' },
  { key: 'gems', label: 'Gems' },
  { key: 'communities', label: 'Communities' },
];

const REPORT_FILTERS: { key: ReportFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function StatCard({ label, value, theme }: { label: string; value: string | number; theme: Theme }) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const [stats, setStats] = useState<Record<string, number>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');

  const [gems, setGems] = useState<GemRow[]>([]);
  const [gemsLoading, setGemsLoading] = useState(false);
  const [gemSearch, setGemSearch] = useState('');
  const [gemCategory, setGemCategory] = useState<string | null>(null);

  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.back();
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        Alert.alert('Access denied', 'You do not have admin access.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        setCheckingAccess(false);
        return;
      }

      setIsAdmin(true);
      setCheckingAccess(false);
    };

    checkAccess();
  }, [router]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [
      totalUsers,
      premiumUsers,
      lifetimeUsers,
      totalGems,
      totalCommunities,
      pendingReports,
      dau,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('premium_tier', 'lifetime'),
      supabase.from('gems').select('*', { count: 'exact', head: true }),
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('last_active_date', today),
    ]);

    const lifetimeCount = lifetimeUsers.count ?? 0;

    setStats({
      totalUsers: totalUsers.count ?? 0,
      premiumUsers: premiumUsers.count ?? 0,
      lifetimeUsers: lifetimeCount,
      totalGems: totalGems.count ?? 0,
      totalCommunities: totalCommunities.count ?? 0,
      pendingReports: pendingReports.count ?? 0,
      dau: dau.count ?? 0,
      lifetimeSlotsRemaining: Math.max(0, 1000 - lifetimeCount),
    });
    setStatsLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setUsers((data as Profile[]) ?? []);
    setUsersLoading(false);
  }, []);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });
    console.log('Admin reports raw fetch:', data, error);
    setReports((data as Report[]) ?? []);
    setReportsLoading(false);
  }, []);

  const fetchGems = useCallback(async () => {
    setGemsLoading(true);
    const { data } = await supabase
      .from('gems')
      .select('id, title, category, image_url, created_at, user_id, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(100);

    const rows = (data ?? []) as Omit<GemRow, 'likesCount'>[];
    const gemIds = rows.map((g) => g.id);

    let likesMap: Record<string, number> = {};
    if (gemIds.length > 0) {
      const { data: likes } = await supabase.from('gem_likes').select('gem_id').in('gem_id', gemIds);
      likesMap = (likes ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.gem_id] = (acc[row.gem_id] ?? 0) + 1;
        return acc;
      }, {});
    }

    setGems(rows.map((g) => ({ ...g, likesCount: likesMap[g.id] ?? 0 })));
    setGemsLoading(false);
  }, []);

  const fetchCommunities = useCallback(async () => {
    setCommunitiesLoading(true);
    const { data } = await supabase
      .from('communities')
      .select('id, name, created_at, creator_id, creator:profiles!communities_creator_id_fkey(username)')
      .order('created_at', { ascending: false });

    const rows = (data ?? []) as Omit<CommunityRow, 'memberCount'>[];
    const withCounts = await Promise.all(
      rows.map(async (c) => {
        const { count } = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', c.id);
        return { ...c, memberCount: count ?? 0 };
      }),
    );
    setCommunities(withCounts);
    setCommunitiesLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'overview') fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'gems') fetchGems();
    if (activeTab === 'communities') fetchCommunities();
  }, [isAdmin, activeTab, fetchStats, fetchUsers, fetchReports, fetchGems, fetchCommunities]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const username = (u.username ?? '').toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      return username.includes(q) || email.includes(q) || u.id.toLowerCase().includes(q);
    });
  }, [users, userSearch]);

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return reports;
    return reports.filter((r) => r.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredGems = useMemo(() => {
    let list = gems;
    if (gemCategory) list = list.filter((g) => g.category === gemCategory);
    const q = gemSearch.trim().toLowerCase();
    if (q) list = list.filter((g) => g.title.toLowerCase().includes(q));
    return list;
  }, [gems, gemCategory, gemSearch]);

  const updateProfile = async (userId: string, updates: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) {
      Alert.alert('Error', error.message);
      return false;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
    return true;
  };

  const handleTogglePremium = (user: Profile) => {
    updateProfile(user.id, { is_premium: !user.is_premium });
  };

  const handleToggleAdmin = (user: Profile) => {
    const next = !user.is_admin;
    Alert.alert(
      next ? 'Grant admin access?' : 'Remove admin access?',
      `@${user.username ?? user.id} will ${next ? 'gain' : 'lose'} admin privileges.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: () => updateProfile(user.id, { is_admin: next }) },
      ],
    );
  };

  const handleBanUser = (user: Profile) => {
    Alert.alert(
      'Ban user?',
      `@${user.username ?? user.id} will be suspended and signed out on next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban',
          style: 'destructive',
          onPress: () => updateProfile(user.id, { is_banned: true }),
        },
      ],
    );
  };

  const handleReportStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
  };

  const handleViewTarget = async (report: Report) => {
    if (report.target_type === 'gem') {
      router.push('/gem/' + report.target_id);
      return;
    }
    if (report.target_type === 'user') {
      router.push('/profile?userId=' + report.target_id);
      return;
    }
    if (report.target_type === 'comment') {
      const { data } = await supabase
        .from('comments')
        .select('gem_id')
        .eq('id', report.target_id)
        .single();
      if (data?.gem_id) router.push('/gem/' + data.gem_id);
      else Alert.alert('Not found', 'Could not find parent gem for this comment.');
      return;
    }
    Alert.alert('Message report', 'Message target navigation not implemented.');
  };

  const handleDeleteGem = (gem: GemRow) => {
    Alert.alert('Delete gem?', `"${gem.title}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (gem.image_url) {
            const fileName = gem.image_url.split('/').pop();
            if (fileName) {
              await supabase.storage.from('gem-images').remove([fileName]);
            }
          }
          const { error } = await supabase.from('gems').delete().eq('id', gem.id);
          if (error) {
            Alert.alert('Error', 'Could not delete gem');
            return;
          }
          setGems((prev) => prev.filter((g) => g.id !== gem.id));
        },
      },
    ]);
  };

  const handleDeleteCommunity = (community: CommunityRow) => {
    Alert.alert('Delete community?', `"${community.name}" and its members will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('communities').delete().eq('id', community.id);
          if (error) {
            Alert.alert('Error', error.message);
            return;
          }
          setCommunities((prev) => prev.filter((c) => c.id !== community.id));
        },
      },
    ]);
  };

  const renderOverview = () => {
    const items = [
      { label: 'Total Users', value: stats.totalUsers ?? 0 },
      { label: 'Premium Users', value: stats.premiumUsers ?? 0 },
      { label: 'Lifetime Users', value: stats.lifetimeUsers ?? 0 },
      { label: 'Total Gems', value: stats.totalGems ?? 0 },
      { label: 'Total Communities', value: stats.totalCommunities ?? 0 },
      { label: 'Pending Reports', value: stats.pendingReports ?? 0 },
      { label: 'DAU Estimate', value: stats.dau ?? 0 },
      { label: 'Lifetime Slots Left', value: stats.lifetimeSlotsRemaining ?? 0 },
    ];

    return (
      <View style={styles.statsGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.statCardWrap}>
            <StatCard label={item.label} value={item.value} theme={theme} />
          </View>
        ))}
      </View>
    );
  };

  const renderUserRow = ({ item }: { item: Profile }) => {
    const initial = (item.username ?? '?').charAt(0).toUpperCase();
    const expanded = expandedUserId === item.id;

    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setExpandedUserId(expanded ? null : item.id)}
          activeOpacity={0.7}
          style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: theme.accentSubtle }]}>
            <Text style={[styles.avatarText, { color: theme.accent }]}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                {item.username ?? 'Unknown'}
              </Text>
              {item.is_premium ? (
                <View style={[styles.badge, { backgroundColor: theme.accentSubtle }]}>
                  <Text style={[styles.badgeText, { color: theme.accent }]}>Premium</Text>
                </View>
              ) : null}
              {item.is_admin ? (
                <View style={[styles.badge, { backgroundColor: theme.coralSubtle }]}>
                  <Text style={[styles.badgeText, { color: theme.coral }]}>Admin</Text>
                </View>
              ) : null}
              {item.is_banned ? (
                <View style={[styles.badge, { backgroundColor: 'rgba(255,68,68,0.15)' }]}>
                  <Text style={[styles.badgeText, { color: theme.danger }]}>Banned</Text>
                </View>
              ) : null}
            </View>
            {item.email ? (
              <Text style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
            <Text style={[styles.rowMeta, { color: theme.textTertiary }]}>
              Joined {formatDate(item.created_at)}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.textTertiary}
          />
        </TouchableOpacity>

        {expanded ? (
          <View style={[styles.userDetail, { borderTopColor: theme.border }]}>
            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
              ID: {item.id}
            </Text>
            {item.home_town ? (
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Home: {item.home_town}
              </Text>
            ) : null}
            {item.premium_tier ? (
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Tier: {item.premium_tier}
              </Text>
            ) : null}
            {item.last_active_date ? (
              <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                Last active: {item.last_active_date}
              </Text>
            ) : null}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.accentSubtle }]}
                onPress={() => handleTogglePremium(item)}
                activeOpacity={0.8}>
                <Text style={[styles.actionBtnText, { color: theme.accent }]}>
                  {item.is_premium ? 'Revoke Premium' : 'Toggle Premium'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.accentSubtle }]}
                onPress={() => handleToggleAdmin(item)}
                activeOpacity={0.8}>
                <Text style={[styles.actionBtnText, { color: theme.accent }]}>
                  {item.is_admin ? 'Remove Admin' : 'Toggle Admin'}
                </Text>
              </TouchableOpacity>
            </View>
            {!item.is_banned ? (
              <TouchableOpacity
                style={[styles.dangerBtn, { backgroundColor: 'rgba(255,68,68,0.12)' }]}
                onPress={() => handleBanUser(item)}
                activeOpacity={0.8}>
                <Text style={[styles.dangerBtnText, { color: theme.danger }]}>Ban User</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderReportRow = ({ item }: { item: Report }) => (
    <View style={[styles.card, styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.reportHeader}>
        <View style={[styles.typeBadge, { backgroundColor: theme.accentSubtle }]}>
          <Text style={[styles.typeBadgeText, { color: theme.accent }]}>{item.target_type}</Text>
        </View>
        <Text style={[styles.rowMeta, { color: theme.textTertiary }]}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={[styles.rowTitle, { color: theme.text }]}>{item.reason}</Text>
      <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
        by @{item.reporter?.username ?? 'unknown'} · {item.status}
      </Text>
      {item.details ? (
        <Text style={[styles.detailText, { color: theme.textSecondary }]}>{item.details}</Text>
      ) : null}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.accentSubtle }]}
          onPress={() => handleViewTarget(item)}
          activeOpacity={0.8}>
          <Text style={[styles.actionBtnText, { color: theme.accent }]}>View Target</Text>
        </TouchableOpacity>
        {item.status === 'pending' ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.accentSubtle }]}
              onPress={() => handleReportStatus(item.id, 'resolved')}
              activeOpacity={0.8}>
              <Text style={[styles.actionBtnText, { color: theme.accent }]}>Resolve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.accentSubtle }]}
              onPress={() => handleReportStatus(item.id, 'dismissed')}
              activeOpacity={0.8}>
              <Text style={[styles.actionBtnText, { color: theme.accent }]}>Dismiss</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );

  const renderGemRow = ({ item }: { item: GemRow }) => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.gemRow}>
        <View style={styles.gemInfo}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
            {item.category} · @{item.profiles?.username ?? 'unknown'}
          </Text>
          <Text style={[styles.rowMeta, { color: theme.textTertiary }]}>
            {formatDate(item.created_at)} · {item.likesCount} likes
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: theme.danger }]}
          onPress={() => handleDeleteGem(item)}
          activeOpacity={0.8}>
          <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCommunityRow = ({ item }: { item: CommunityRow }) => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.gemRow}>
        <View style={styles.gemInfo}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
            by @{item.creator?.username ?? 'unknown'}
          </Text>
          <Text style={[styles.rowMeta, { color: theme.textTertiary }]}>
            {item.memberCount} members · {formatDate(item.created_at)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: theme.danger }]}
          onPress={() => handleDeleteCommunity(item)}
          activeOpacity={0.8}>
          <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      if (statsLoading) {
        return (
          <View style={styles.tabLoading}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        );
      }
      return <ScrollView contentContainerStyle={styles.tabContent}>{renderOverview()}</ScrollView>;
    }

    if (activeTab === 'users') {
      if (usersLoading) {
        return (
          <View style={styles.tabLoading}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        );
      }

      return (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserRow}
          contentContainerStyle={styles.tabContent}
          ListHeaderComponent={
            <TextInput
              style={[
                styles.searchInput,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Search username or email..."
              placeholderTextColor={theme.textSecondary}
              value={userSearch}
              onChangeText={setUserSearch}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users found</Text>
          }
        />
      );
    }

    if (activeTab === 'reports') {
      if (reportsLoading) {
        return (
          <View style={styles.tabLoading}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        );
      }

      return (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportRow}
          contentContainerStyle={styles.tabContent}
          ListHeaderComponent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {REPORT_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: reportFilter === f.key ? theme.accent : theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setReportFilter(f.key)}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: reportFilter === f.key ? theme.background : theme.textSecondary },
                    ]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No reports</Text>
          }
        />
      );
    }

    if (activeTab === 'gems') {
      if (gemsLoading) {
        return (
          <View style={styles.tabLoading}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        );
      }

      return (
        <FlatList
          data={filteredGems}
          keyExtractor={(item) => item.id}
          renderItem={renderGemRow}
          contentContainerStyle={styles.tabContent}
          ListHeaderComponent={
            <View>
              <TextInput
                style={[
                  styles.searchInput,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Search gems..."
                placeholderTextColor={theme.textSecondary}
                value={gemSearch}
                onChangeText={setGemSearch}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: !gemCategory ? theme.accent : theme.card,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setGemCategory(null)}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: !gemCategory ? theme.background : theme.textSecondary },
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: gemCategory === cat.id ? theme.accent : theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setGemCategory(cat.id)}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.filterPillText,
                        {
                          color: gemCategory === cat.id ? theme.background : theme.textSecondary,
                        },
                      ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No gems</Text>
          }
        />
      );
    }

    if (communitiesLoading) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    return (
      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        renderItem={renderCommunityRow}
        contentContainerStyle={styles.tabContent}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No communities</Text>
        }
      />
    );
  };

  if (checkingAccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.deniedWrap}>
          <Text style={[styles.deniedText, { color: theme.text }]}>Access denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Dashboard</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabBar, { backgroundColor: theme.card }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { backgroundColor: theme.accent }]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.key ? theme.background : theme.textSecondary },
                activeTab === tab.key && styles.tabTextActive,
              ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.content}>{renderTabContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statCard: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 14,
  },
  statValue: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
});

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerSide: {
      width: 22,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: 'SpaceGrotesk-Bold',
    },
    tabBar: {
      flexDirection: 'row',
      borderRadius: 10,
      padding: 4,
      marginHorizontal: 16,
      marginBottom: 12,
      gap: 4,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '500',
    },
    tabTextActive: {
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    tabContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      gap: 10,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCardWrap: {
      width: '48%',
    },
    tabLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 60,
    },
    deniedWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deniedText: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk-Bold',
    },
    searchInput: {
      borderWidth: 0.5,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 10,
    },
    filterRow: {
      marginBottom: 10,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 0.5,
      marginRight: 8,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    card: {
      borderRadius: 12,
      borderWidth: 0.5,
      overflow: 'hidden',
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'SpaceGrotesk-Bold',
    },
    userInfo: {
      flex: 1,
      gap: 2,
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    rowSub: {
      fontSize: 12,
    },
    rowMeta: {
      fontSize: 11,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '600',
    },
    userDetail: {
      padding: 12,
      borderTopWidth: 0.5,
      gap: 8,
    },
    detailText: {
      fontSize: 12,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    dangerBtn: {
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
    },
    dangerBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
    reportCard: {
      padding: 12,
      gap: 6,
    },
    reportHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    gemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    gemInfo: {
      flex: 1,
      gap: 2,
    },
    deleteBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    deleteBtnText: {
      fontSize: 12,
      fontWeight: '600',
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 24,
      fontSize: 14,
    },
  });
}
