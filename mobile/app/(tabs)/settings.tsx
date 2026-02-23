import { ScrollView, View, Switch, TouchableOpacity, Alert, TextInput, Image, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useAuthStore } from '@/store/auth';
import { useOnboardingStore } from '@/store/onboarding';
import { apiFetch, getAgentBalance } from '@/lib/api/client';
import { colors } from '@/theme/colors';
import { lightImpact } from '@/lib/haptics';
import { useState, useEffect } from 'react';

const solanaIcon = require('../../assets/icons/solana.png');

function SettingRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text variant="body" color="primary">{label}</Text>
        <Text variant="caption" color="muted">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.surface.tertiary,
          true: colors.brand.primary,
        }}
        thumbColor={colors.text.primary}
      />
    </View>
  );
}

export default function SettingsTab() {
  const { user, logout, isAuthenticated } = useAuth();
  const { settings, updateSetting } = useSettings();
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const setAgentMe = useAuthStore((s) => s.setAgentMe);
  const stats = useAuthStore((s) => s.stats);
  const onboarding = useAuthStore((s) => s.onboarding);

  const [editName, setEditName] = useState(agentProfile?.name ?? '');
  const [editBio, setEditBio] = useState(agentProfile?.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [solBalance, setSolBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeAgentId = useAuthStore((s) => s.activeAgentId);
  const walletAddress = user?.walletAddress ?? agentProfile?.pubkey ?? null;

  useEffect(() => {
    if (!activeAgentId) return;
    getAgentBalance(activeAgentId)
      .then((data) => setSolBalance(data.balanceFormatted))
      .catch(() => setSolBalance(null));
  }, [activeAgentId]);

  const handleCopyAddress = () => {
    if (!walletAddress) return;
    Clipboard.setStringAsync(walletAddress);
    lightImpact();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasChanges =
    editName !== (agentProfile?.name ?? '') ||
    editBio !== (agentProfile?.bio ?? '');

  const handleSaveProfile = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await apiFetch('/profile/update', {
        method: 'POST',
        body: JSON.stringify({ name: editName.trim(), bio: editBio.trim() }),
      });
      // Update local store
      if (agentProfile) {
        setAgentMe({
          agent: { ...agentProfile, name: editName.trim(), bio: editBio.trim() },
          stats,
          onboarding: onboarding ?? { tasks: [], completedTasks: 0, totalTasks: 0, progress: 0 },
        });
      }
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: 'transparent' }}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <Text variant="h2" color="primary">Settings</Text>

        {/* Profile */}
        {isAuthenticated && user && (
          <Card variant="default" padding="md">
            <Text variant="h3" color="primary" style={{ marginBottom: 8 }}>
              Profile
            </Text>
            <Text variant="body" color="secondary">
              {user.twitterUsername ? `@${user.twitterUsername}` : 'Connected'}
            </Text>
            {user.walletAddress && (
              <Text variant="caption" color="muted" style={{ marginTop: 4 }}>
                {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              </Text>
            )}

            {/* Editable fields */}
            {agentProfile && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={{ gap: 4 }}>
                  <Text variant="caption" color="muted">Agent Name</Text>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Agent name"
                    placeholderTextColor={colors.text.muted}
                    maxLength={32}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      padding: 10,
                      color: colors.text.primary,
                      fontSize: 14,
                    }}
                  />
                </View>
                <View style={{ gap: 4 }}>
                  <Text variant="caption" color="muted">Bio</Text>
                  <TextInput
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Describe your agent..."
                    placeholderTextColor={colors.text.muted}
                    multiline
                    numberOfLines={3}
                    maxLength={160}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      padding: 10,
                      color: colors.text.primary,
                      fontSize: 14,
                      minHeight: 64,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>
                {hasChanges && (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isSaving}
                    onPress={handleSaveProfile}
                  >
                    <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
                      Save Changes
                    </Text>
                  </Button>
                )}
              </View>
            )}
          </Card>
        )}

        {/* Wallet & Balance */}
        {isAuthenticated && walletAddress && (
          <Card variant="default" padding="md">
            <Text variant="h3" color="primary" style={{ marginBottom: 8 }}>
              Wallet & Balance
            </Text>

            {/* SOL Balance */}
            {solBalance !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Image source={solanaIcon} style={{ width: 20, height: 20 }} />
                <Text variant="body" color="primary" style={{ fontWeight: '700', fontSize: 18 }}>
                  {solBalance} SOL
                </Text>
              </View>
            )}

            {/* Full wallet address */}
            <Text
              variant="caption"
              color="muted"
              style={{ fontFamily: 'Courier', fontSize: 11, lineHeight: 16 }}
            >
              {walletAddress}
            </Text>

            {/* Copy + Solscan row */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? colors.status.success : colors.text.secondary} />
                <Text variant="caption" style={{ color: copied ? colors.status.success : colors.text.secondary, fontWeight: '600' }}>
                  {copied ? 'Copied!' : 'Copy Address'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => Linking.openURL(`https://solscan.io/account/${walletAddress}`)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  paddingVertical: 8,
                }}
              >
                <Ionicons name="open-outline" size={14} color={colors.text.secondary} />
                <Text variant="caption" color="secondary" style={{ fontWeight: '600' }}>
                  View on Solscan
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Settings */}
        <Card variant="default" padding="md">
          <Text variant="h3" color="primary" style={{ marginBottom: 4 }}>
            Preferences
          </Text>
          <SettingRow
            label="Auto-Sign Transactions"
            description="Automatically approve AI trades"
            value={settings.autoSign}
            onValueChange={(v) => updateSetting('autoSign', v)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1 }}
          />
          <SettingRow
            label="Haptic Feedback"
            description="Vibration on interactions"
            value={settings.haptics}
            onValueChange={(v) => updateSetting('haptics', v)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1 }}
          />
          <SettingRow
            label="Push Notifications"
            description="Trade alerts and updates"
            value={settings.pushNotifications}
            onValueChange={(v) => updateSetting('pushNotifications', v)}
          />
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1 }}
          />
          <SettingRow
            label="Sound Effects"
            description="Audio feedback on events"
            value={settings.sound}
            onValueChange={(v) => updateSetting('sound', v)}
          />
        </Card>

        {/* Sign Out */}
        {isAuthenticated && (
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.status.error + '33',
            }}
          >
            <Text variant="body" color="error" style={{ fontWeight: '600' }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        )}

        {/* App Info */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Text variant="caption" color="muted">SuperMolt v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
