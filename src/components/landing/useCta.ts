import { useAuth } from '@/hooks/useAuth';

/** Primary call to action: sign-up for visitors, the dashboard for signed-in users. */
export function useCta() {
  const { user } = useAuth();
  return {
    href: user ? '/app' : '/auth',
    label: user ? 'Go to dashboard' : 'Start free',
    signedIn: !!user,
  };
}
