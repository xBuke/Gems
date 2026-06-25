import { AppBottomSheetModal } from '@/components/AppBottomSheetModal';
import { useTheme } from '@/lib/ThemeContext';
import { semantic, type Theme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type SafetyOptionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  username: string;
  reportLabel: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onBlock: () => void;
  onReport: () => void;
};

type OptionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconColor: string;
  labelColor: string;
  styles: ReturnType<typeof createStyles>;
};

function OptionRow({ icon, label, onPress, iconColor, labelColor, styles }: OptionRowProps) {
  return (
    <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={[styles.optionLabel, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SafetyOptionsSheet({
  visible,
  onClose,
  username,
  reportLabel,
  isMuted,
  onToggleMute,
  onBlock,
  onReport,
}: SafetyOptionsSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleToggleMute = () => {
    onClose();
    onToggleMute();
  };

  const handleBlock = () => {
    onClose();
    onBlock();
  };

  const handleReport = () => {
    onClose();
    onReport();
  };

  return (
    <AppBottomSheetModal visible={visible} onClose={onClose} snapPoints={['32%']}>
      <BottomSheetView style={styles.content}>
        <OptionRow
          icon={isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
          label={isMuted ? `Unmute @${username}` : `Mute @${username}`}
          onPress={handleToggleMute}
          iconColor={theme.textSecondary}
          labelColor={theme.text}
          styles={styles}
        />
        <OptionRow
          icon="ban-outline"
          label={`Block @${username}`}
          onPress={handleBlock}
          iconColor={semantic.error}
          labelColor={semantic.error}
          styles={styles}
        />
        <OptionRow
          icon="flag-outline"
          label={reportLabel}
          onPress={handleReport}
          iconColor={theme.textSecondary}
          labelColor={theme.text}
          styles={styles}
        />
        <TouchableOpacity style={styles.cancelRow} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      gap: 4,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.border,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '500',
    },
    cancelRow: {
      alignItems: 'center',
      paddingVertical: 16,
      marginTop: 4,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  });
