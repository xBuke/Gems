import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@/lib/theme';

type Tab = {
  key: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  theme: Theme;
  width?: number;
};

export function SegmentedPill({ tabs, activeKey, onChange, theme, width = 226 }: Props) {
  return (
    <View
      style={[
        styles.container,
        {
          width,
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}>
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tab, active && { backgroundColor: theme.accent }]}
            onPress={() => onChange(tab.key)}>
            <Text
              style={[
                styles.tabText,
                { color: active ? theme.accentText : theme.textSecondary },
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 0.5,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Bold',
  },
});
