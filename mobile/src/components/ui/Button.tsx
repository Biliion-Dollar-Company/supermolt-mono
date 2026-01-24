import {
  Pressable,
  PressableProps,
  ActivityIndicator,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { ReactNode } from 'react';
import { colors } from '@/theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<ButtonVariant, { bg: string; border?: string; pressedBg: string }> = {
  primary: {
    bg: colors.brand.primary,
    pressedBg: '#5a9b60', // Slightly darker green
  },
  secondary: {
    bg: colors.surface.secondary,
    border: colors.void[600],
    pressedBg: colors.surface.tertiary,
  },
  outline: {
    bg: 'transparent',
    border: colors.brand.primary,
    pressedBg: colors.glass.green,
  },
  ghost: {
    bg: 'transparent',
    pressedBg: colors.glass.white,
  },
};

const sizeStyles: Record<ButtonSize, { py: number; px: number; height: number }> = {
  sm: { py: 8, px: 12, height: 36 },
  md: { py: 12, px: 16, height: 48 },
  lg: { py: 16, px: 20, height: 56 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  leftIcon,
  rightIcon,
  style,
  ...props
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          backgroundColor: pressed ? variantStyle.pressedBg : variantStyle.bg,
          borderWidth: variantStyle.border ? 1 : 0,
          borderColor: variantStyle.border,
          paddingVertical: sizeStyle.py,
          paddingHorizontal: sizeStyle.px,
          minHeight: sizeStyle.height,
          opacity: disabled ? 0.5 : 1,
          gap: 8,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.text.primary : colors.brand.primary}
        />
      ) : (
        <>
          {leftIcon && <View>{leftIcon}</View>}
          {children}
          {rightIcon && <View>{rightIcon}</View>}
        </>
      )}
    </Pressable>
  );
}
