import { View, Text, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { login, connectWallet, isLoading } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center">
        {/* Logo and title */}
        <View className="items-center mb-12">
          <View className="w-20 h-20 rounded-2xl bg-brand-primary/20 items-center justify-center mb-4">
            <Ionicons name="rocket" size={40} color="#8B5CF6" />
          </View>
          <Text className="text-foreground text-3xl font-bold">SuperRouter</Text>
          <Text className="text-foreground-secondary text-center mt-2">
            AI-powered trading on Solana
          </Text>
        </View>

        {/* Login buttons */}
        <View className="gap-3">
          {/* Email/Google login (Privy) */}
          <Pressable
            onPress={login}
            disabled={isLoading}
            className="bg-brand-primary py-4 rounded-xl flex-row items-center justify-center active:opacity-80"
          >
            <Ionicons name="mail" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              Continue with Email
            </Text>
          </Pressable>

          {/* Google */}
          <Pressable
            onPress={login}
            disabled={isLoading}
            className="bg-card border border-border py-4 rounded-xl flex-row items-center justify-center active:opacity-80"
          >
            <Ionicons name="logo-google" size={20} color="#a1a1aa" />
            <Text className="text-foreground font-semibold ml-2">
              Continue with Google
            </Text>
          </Pressable>

          {/* Divider */}
          <View className="flex-row items-center my-4">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-foreground-muted px-4">or</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Connect Wallet (MWA) */}
          <Pressable
            onPress={connectWallet}
            disabled={isLoading}
            className="bg-card border border-border py-4 rounded-xl flex-row items-center justify-center active:opacity-80"
          >
            <Ionicons name="wallet-outline" size={20} color="#8B5CF6" />
            <Text className="text-foreground font-semibold ml-2">
              Connect Wallet
            </Text>
          </Pressable>

          {/* Wallet options info */}
          <View className="flex-row justify-center gap-4 mt-2">
            <Text className="text-foreground-muted text-xs">Seed Vault</Text>
            <Text className="text-foreground-muted text-xs">Phantom</Text>
            <Text className="text-foreground-muted text-xs">Solflare</Text>
          </View>
        </View>

        {/* Footer */}
        <View className="mt-12">
          <Text className="text-foreground-muted text-center text-xs">
            By continuing, you agree to our Terms of Service
          </Text>
          <Text className="text-foreground-muted text-center text-xs mt-1">
            and Privacy Policy
          </Text>
        </View>
      </View>

      {/* Seeker badge */}
      <View className="absolute bottom-safe-bottom pb-4 left-0 right-0 items-center">
        <View className="flex-row items-center gap-2 px-4 py-2 bg-card rounded-full">
          <View className="w-2 h-2 rounded-full bg-success" />
          <Text className="text-foreground-secondary text-xs">
            Optimized for Solana Seeker
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
