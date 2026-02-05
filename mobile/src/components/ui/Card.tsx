import { View, ViewProps, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { colors } from '@/theme/colors';

type CardVariant = 'default' | 'outlined' | 'glass';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 0,
  },
  outlined: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.void[600],
  },
  glass: {
    backgroundColor: colors.glass.white,
    borderWidth: 1,
    borderColor: colors.void[600],
  },
};

const paddingStyles: Record<'none' | 'sm' | 'md' | 'lg', number> = {
  none: 0,
  sm: 8,
  md: 16,
  lg: 24,
};

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  style,
  ...props
}: CardProps) {
  const variantStyle = variantStyles[variant];

  return (
    <View
      style={[
        variantStyle,
        {
          borderRadius: 16,
          padding: paddingStyles[padding],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
