import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { colors } from '@/theme/colors';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'label';
type TextColor = 'primary' | 'secondary' | 'muted' | 'success' | 'error' | 'warning' | 'brand';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

const variantStyles: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
};

const colorStyles: Record<TextColor, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  success: colors.status.success,
  error: colors.status.error,
  warning: colors.status.warning,
  brand: colors.brand.primary,
};

export function Text({
  variant = 'body',
  color = 'primary',
  weight,
  align,
  style,
  ...props
}: TextProps) {
  const variantStyle = variantStyles[variant];

  return (
    <RNText
      style={[
        variantStyle,
        {
          color: colorStyles[color],
          fontWeight: weight ?? variantStyle.fontWeight,
          textAlign: align,
        },
        style,
      ]}
      {...props}
    />
  );
}
