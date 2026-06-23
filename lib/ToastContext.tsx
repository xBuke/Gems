import { useTheme } from '@/lib/ThemeContext';
import { semantic } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastOptions = {
  type: ToastType;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onPress?: () => void;
};

type ToastItem = ToastOptions & { id: string };

type ToastContextType = {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  dismissToast: () => {},
});

const AUTO_DISMISS_MS = 4000;

const getTypeColor = (type: ToastType, accent: string) => {
  switch (type) {
    case 'success':
    case 'info':
      return accent;
    case 'error':
      return semantic.error;
    case 'warning':
      return semantic.warning;
  }
};

const getTypeIcon = (type: ToastType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'success':
      return 'checkmark';
    case 'error':
      return 'alert-circle';
    case 'warning':
      return 'warning';
    case 'info':
      return 'information-circle';
  }
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const typeColor = getTypeColor(toast.type, theme.accent);
  const iconName = getTypeIcon(toast.type);
  const showRetry =
    toast.type === 'error' && toast.actionLabel && toast.onAction;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, slideAnim]);

  const mainContent = (
    <>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: hexToRgba(typeColor, 0.13) },
        ]}>
        <Ionicons name={iconName} size={14} color={typeColor} />
      </View>

      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{toast.title}</Text>
        {toast.message ? (
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {toast.message}
          </Text>
        ) : null}
      </View>
    </>
  );

  const trailingAction = showRetry ? (
    <TouchableOpacity
      style={[
        styles.retryPill,
        { backgroundColor: hexToRgba(semantic.error, 0.12) },
      ]}
      onPress={() => {
        toast.onAction?.();
        onDismiss(toast.id);
      }}
      activeOpacity={0.7}>
      <Text style={[styles.retryText, { color: semantic.error }]}>
        {toast.actionLabel}
      </Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      onPress={() => onDismiss(toast.id)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}>
      <Text style={[styles.dismiss, { color: theme.textTertiary }]}>×</Text>
    </TouchableOpacity>
  );

  const cardStyle = [
    styles.toast,
    {
      backgroundColor: theme.card,
      borderLeftColor: typeColor,
      opacity: opacityAnim,
      transform: [{ translateY: slideAnim }],
    },
  ];

  if (toast.onPress) {
    return (
      <Animated.View style={cardStyle}>
        <TouchableOpacity
          style={styles.pressableRow}
          onPress={() => {
            toast.onPress?.();
            onDismiss(toast.id);
          }}
          activeOpacity={0.85}>
          {mainContent}
        </TouchableOpacity>
        {trailingAction}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={cardStyle}>
      {mainContent}
      {trailingAction}
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const idRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = String(++idRef.current);
      const item: ToastItem = { ...options, id };

      setToasts((prev) => [...prev, item]);

      if (options.type !== 'error') {
        const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
        timersRef.current.set(id, timer);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <View
        style={[styles.container, { top: insets.top + 8 }]}
        pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  pressableRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
  },
  dismiss: {
    fontSize: 20,
    lineHeight: 22,
    paddingHorizontal: 2,
  },
  retryPill: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  retryText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 12,
    fontWeight: '600',
  },
});
