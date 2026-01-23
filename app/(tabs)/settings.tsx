import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

export default function SettingsScreen() {
  const { user, wallet, logout } = useAuth();
  const { settings, updateSetting } = useSettings();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="pb-6">
        {/* Header */}
        <View className="px-4 pt-4">
          <Text className="text-foreground text-2xl font-bold">Settings</Text>
        </View>

        {/* Wallet Section */}
        <View className="mx-4 mt-6">
          <Text className="text-foreground-secondary text-sm font-medium mb-3">
            WALLET
          </Text>
          <View className="bg-card rounded-xl overflow-hidden">
            <View className="p-4 border-b border-border">
              <Text className="text-foreground-muted text-sm">Connected</Text>
              <Text className="text-foreground font-mono mt-1">
                {wallet?.address
                  ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
                  : 'Not connected'}
              </Text>
            </View>
            <Pressable className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons name="wallet-outline" size={20} color="#a1a1aa" />
                <Text className="text-foreground">Change Wallet</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717a" />
            </Pressable>
          </View>
        </View>

        {/* Trading Settings */}
        <View className="mx-4 mt-6">
          <Text className="text-foreground-secondary text-sm font-medium mb-3">
            TRADING
          </Text>
          <View className="bg-card rounded-xl overflow-hidden">
            <View className="p-4 border-b border-border flex-row items-center justify-between">
              <View>
                <Text className="text-foreground">Auto-Sign Trades</Text>
                <Text className="text-foreground-muted text-sm mt-1">
                  Skip approval for small trades
                </Text>
              </View>
              <Switch
                value={settings.autoSign}
                onValueChange={(value) => updateSetting('autoSign', value)}
                trackColor={{ false: '#27272a', true: '#8B5CF6' }}
                thumbColor="#fafafa"
              />
            </View>
            <View className="p-4 border-b border-border flex-row items-center justify-between">
              <View>
                <Text className="text-foreground">Haptic Feedback</Text>
                <Text className="text-foreground-muted text-sm mt-1">
                  Vibrate on trade events
                </Text>
              </View>
              <Switch
                value={settings.haptics}
                onValueChange={(value) => updateSetting('haptics', value)}
                trackColor={{ false: '#27272a', true: '#8B5CF6' }}
                thumbColor="#fafafa"
              />
            </View>
            <Pressable className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons name="options-outline" size={20} color="#a1a1aa" />
                <Text className="text-foreground">Trading Config</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717a" />
            </Pressable>
          </View>
        </View>

        {/* Notifications */}
        <View className="mx-4 mt-6">
          <Text className="text-foreground-secondary text-sm font-medium mb-3">
            NOTIFICATIONS
          </Text>
          <View className="bg-card rounded-xl overflow-hidden">
            <View className="p-4 border-b border-border flex-row items-center justify-between">
              <View>
                <Text className="text-foreground">Push Notifications</Text>
                <Text className="text-foreground-muted text-sm mt-1">
                  Get alerts for trades
                </Text>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={(value) =>
                  updateSetting('pushNotifications', value)
                }
                trackColor={{ false: '#27272a', true: '#8B5CF6' }}
                thumbColor="#fafafa"
              />
            </View>
            <View className="p-4 flex-row items-center justify-between">
              <View>
                <Text className="text-foreground">Sound</Text>
                <Text className="text-foreground-muted text-sm mt-1">
                  Play sound on events
                </Text>
              </View>
              <Switch
                value={settings.sound}
                onValueChange={(value) => updateSetting('sound', value)}
                trackColor={{ false: '#27272a', true: '#8B5CF6' }}
                thumbColor="#fafafa"
              />
            </View>
          </View>
        </View>

        {/* Account */}
        <View className="mx-4 mt-6">
          <Text className="text-foreground-secondary text-sm font-medium mb-3">
            ACCOUNT
          </Text>
          <View className="bg-card rounded-xl overflow-hidden">
            <Pressable className="p-4 border-b border-border flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons name="help-circle-outline" size={20} color="#a1a1aa" />
                <Text className="text-foreground">Help & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717a" />
            </Pressable>
            <Pressable
              className="p-4 flex-row items-center gap-3"
              onPress={logout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="text-error">Disconnect</Text>
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <Text className="text-foreground-muted text-center text-sm mt-8">
          SuperRouter Mobile v0.1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
