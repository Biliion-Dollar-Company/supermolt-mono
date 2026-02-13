import { ScrollView, View, Switch, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Card, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api/client';
import { colors } from '@/theme/colors';
import { useState } from 'react';

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
  const agentProfile = useAuthStore((s) => s.agentProfile);
  const setAgentMe = useAuthStore((s) => s.setAgentMe);
  const stats = useAuthStore((s) => s.stats);
  const onboarding = useAuthStore((s) => s.onboarding);

  const [editName, setEditName] = useState(agentProfile?.name ?? '');
  const [editBio, setEditBio] = useState(agentProfile?.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);

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
      style={{ flex: 1, backgroundColor: colors.surface.primary }}
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
                      backgroundColor: colors.surface.tertiary,
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
                      backgroundColor: colors.surface.tertiary,
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
          <View style={{ height: 1, backgroundColor: colors.surface.tertiary }} />
          <SettingRow
            label="Haptic Feedback"
            description="Vibration on interactions"
            value={settings.haptics}
            onValueChange={(v) => updateSetting('haptics', v)}
          />
          <View style={{ height: 1, backgroundColor: colors.surface.tertiary }} />
          <SettingRow
            label="Push Notifications"
            description="Trade alerts and updates"
            value={settings.pushNotifications}
            onValueChange={(v) => updateSetting('pushNotifications', v)}
          />
          <View style={{ height: 1, backgroundColor: colors.surface.tertiary }} />
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
              backgroundColor: colors.surface.secondary,
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
          <Text variant="caption" color="muted">SR-Mobile v0.1.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
