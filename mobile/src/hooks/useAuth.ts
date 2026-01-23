import { useAuthContext } from '@/lib/auth/provider';

export function useAuth() {
  return useAuthContext();
}
