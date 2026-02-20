import { View, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { ReactNode } from 'react';

type CardVariant = 'default' | 'outlined' | 'glass';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  outlined: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
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
  return (
    <View
      style={[
        variantStyles[variant],
        styles.base,
        { padding: paddingStyles[padding] },
        style,
      ]}
      {...props}
    >
      {/* Top highlight line — glass sheen */}
      <View style={styles.highlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: '12%',
    right: '12%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 1,
  },
});
