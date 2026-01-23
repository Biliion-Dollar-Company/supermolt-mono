import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function ApproveTransactionModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    action: string;
    token: string;
    amount: string;
    price: string;
  }>();

  const handleApprove = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: Trigger MWA signing
    console.log('Approving transaction...');
    router.back();
  };

  const handleReject = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center">
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-full bg-brand-primary/20 items-center justify-center">
            <Ionicons name="hardware-chip" size={32} color="#8B5CF6" />
          </View>
          <Text className="text-foreground text-xl font-bold mt-4">
            AI Agent Request
          </Text>
        </View>

        {/* Transaction details */}
        <View className="bg-card rounded-xl p-5 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-foreground-muted">Action</Text>
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={params.action === 'buy' ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={20}
                color={params.action === 'buy' ? '#22C55E' : '#EF4444'}
              />
              <Text className="text-foreground font-semibold capitalize">
                {params.action || 'Buy'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-foreground-muted">Token</Text>
            <Text className="text-foreground font-semibold">
              {params.token || '$PENGU'}
            </Text>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-foreground-muted">Amount</Text>
            <Text className="text-foreground font-semibold">
              {params.amount || '1.5'} SOL
            </Text>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-foreground-muted">Price</Text>
            <Text className="text-foreground font-semibold">
              ${params.price || '0.000025'}
            </Text>
          </View>
        </View>

        {/* Security note */}
        <View className="flex-row items-start gap-3 bg-warning/10 rounded-xl p-4 mb-6">
          <Ionicons name="shield-checkmark" size={20} color="#F59E0B" />
          <Text className="text-foreground-secondary text-sm flex-1">
            This transaction will be signed by your hardware wallet.
            Your keys never leave the secure enclave.
          </Text>
        </View>

        {/* Action buttons */}
        <View className="gap-3">
          <Pressable
            onPress={handleApprove}
            className="bg-success py-4 rounded-xl flex-row items-center justify-center active:opacity-80"
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Approve</Text>
          </Pressable>

          <Pressable
            onPress={handleReject}
            className="bg-card border border-border py-4 rounded-xl flex-row items-center justify-center active:opacity-80"
          >
            <Text className="text-foreground-secondary font-semibold">Reject</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
