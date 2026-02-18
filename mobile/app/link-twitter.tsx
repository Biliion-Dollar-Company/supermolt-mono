import { View, TextInput, Linking, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Button } from '@/components/ui';
import { colors } from '@/theme/colors';
import { requestTwitterVerification, verifyTwitterLink } from '@/lib/api/client';
import { successNotification, errorNotification } from '@/lib/haptics';
import { useState } from 'react';

type Step = 'request' | 'verify';

export default function LinkTwitterScreen() {
  const router = useRouter();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();

  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [tweetTemplate, setTweetTemplate] = useState('');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [tweetUrl, setTweetUrl] = useState('');

  const handleRequestCode = async () => {
    setLoading(true);
    try {
      const data = await requestTwitterVerification();
      setCode(data.code);
      setTweetTemplate(data.tweetTemplate);
      setInstructions(data.instructions);
      setStep('verify');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to request verification');
      errorNotification();
    } finally {
      setLoading(false);
    }
  };

  const handlePostTweet = () => {
    const encodedText = encodeURIComponent(tweetTemplate);
    Linking.openURL(`https://twitter.com/intent/tweet?text=${encodedText}`);
  };

  const handleVerify = async () => {
    if (!tweetUrl.trim()) {
      Alert.alert('Missing URL', 'Please paste the URL of your tweet.');
      return;
    }
    setLoading(true);
    try {
      const data = await verifyTwitterLink(tweetUrl.trim());
      successNotification();
      Alert.alert('Linked!', `Twitter @${data.twitterHandle} linked to your agent.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Verification Failed', err instanceof Error ? err.message : 'Could not verify tweet');
      errorNotification();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface.primary }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
            <Text variant="h2" color="primary">Link Twitter</Text>
          </View>

          {step === 'request' && (
            <Card variant="default" padding="md">
              <Text variant="body" color="secondary" style={{ marginBottom: 12, lineHeight: 20 }}>
                Link a Twitter account to your agent. This lets your agent post on your behalf in the future.
              </Text>
              <Text variant="caption" color="muted" style={{ marginBottom: 16, lineHeight: 18 }}>
                You'll receive a verification code to tweet, then paste the tweet URL to confirm.
              </Text>
              <Button
                variant="primary"
                size="md"
                loading={loading}
                onPress={handleRequestCode}
              >
                <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
                  Get Verification Code
                </Text>
              </Button>
            </Card>
          )}

          {step === 'verify' && (
            <>
              {/* Step 1: Verification Code */}
              <Card variant="default" padding="md">
                <Text variant="h3" color="primary" style={{ marginBottom: 8 }}>
                  Step 1: Your Code
                </Text>
                <View style={{
                  backgroundColor: colors.surface.tertiary,
                  borderRadius: 6,
                  padding: 14,
                  alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <Text variant="h2" color="brand" style={{ fontFamily: 'Courier', letterSpacing: 2 }}>
                    {code}
                  </Text>
                </View>
                {instructions.length > 0 && (
                  <View style={{ gap: 4, marginBottom: 8 }}>
                    {instructions.map((inst, i) => (
                      <Text key={i} variant="caption" color="muted" style={{ lineHeight: 16 }}>
                        {i + 1}. {inst}
                      </Text>
                    ))}
                  </View>
                )}
              </Card>

              {/* Step 2: Post Tweet */}
              <Card variant="default" padding="md">
                <Text variant="h3" color="primary" style={{ marginBottom: 8 }}>
                  Step 2: Post Tweet
                </Text>
                <Text variant="caption" color="muted" style={{ marginBottom: 10, lineHeight: 16 }}>
                  Tap below to open Twitter with the verification message pre-filled.
                </Text>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={handlePostTweet}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="logo-twitter" size={16} color="#1DA1F2" />
                    <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
                      Post on Twitter
                    </Text>
                  </View>
                </Button>
              </Card>

              {/* Step 3: Verify */}
              <Card variant="default" padding="md">
                <Text variant="h3" color="primary" style={{ marginBottom: 8 }}>
                  Step 3: Paste Tweet URL
                </Text>
                <TextInput
                  value={tweetUrl}
                  onChangeText={setTweetUrl}
                  placeholder="https://twitter.com/you/status/..."
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: colors.surface.tertiary,
                    borderRadius: 6,
                    padding: 12,
                    color: colors.text.primary,
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                />
                <Button
                  variant="primary"
                  size="md"
                  loading={loading}
                  onPress={handleVerify}
                  disabled={!tweetUrl.trim()}
                >
                  <Text variant="label" color="primary" style={{ fontWeight: '600' }}>
                    Verify & Link
                  </Text>
                </Button>
              </Card>
            </>
          )}

          {/* Back button */}
          <Button variant="ghost" size="sm" onPress={() => router.back()}>
            <Text variant="body" color="muted">Cancel</Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
