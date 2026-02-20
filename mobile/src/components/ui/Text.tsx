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
  h1: { fontSize: 32, fontFamily: 'Orbitron_700Bold', lineHeight: 40, letterSpacing: 0.5 },
  h2: { fontSize: 24, fontFamily: 'Orbitron_700Bold', lineHeight: 32, letterSpacing: 0.3 },
  h3: { fontSize: 20, fontFamily: 'Orbitron_600SemiBold', lineHeight: 28, letterSpacing: 0.2 },
  body: { fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  caption: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
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
