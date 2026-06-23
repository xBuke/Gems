import { semantic } from '@/lib/theme';
import { StyleSheet, Text, View } from 'react-native';

type FormFieldErrorProps = {
  message?: string;
};

export function FormFieldError({ message }: FormFieldErrorProps) {
  if (!message) return null;

  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export const fieldErrorBorder = {
  borderWidth: 1.5,
  borderColor: semantic.error,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
    marginBottom: 12,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: semantic.error,
  },
  text: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: semantic.error,
    flex: 1,
  },
});
