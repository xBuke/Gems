import { Text, type TextStyle } from 'react-native';

type HighlightTextProps = {
  text: string;
  query: string;
  style?: TextStyle;
  highlightStyle?: TextStyle;
  numberOfLines?: number;
};

export function HighlightText({
  text,
  query,
  style,
  highlightStyle,
  numberOfLines,
}: HighlightTextProps) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + trimmedQuery.length);
  const after = text.slice(index + trimmedQuery.length);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {before}
      <Text style={highlightStyle}>{match}</Text>
      {after}
    </Text>
  );
}
