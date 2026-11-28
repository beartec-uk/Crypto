// Copyright (c) 2026 BEARTEC LTD. All rights reserved.
/**
 * Build-time stand-in for @clerk/clerk-react. The prerender Vite config aliases the
 * real package to this file so public pages can render their signed-out shell
 * without a ClerkProvider, a publishable key, or browser-only Clerk code.
 * The client bundle is unchanged and still imports the real package.
 */
import type { ReactNode } from 'react';

export function ClerkProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SignedOut({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SignedIn(_props: { children?: ReactNode }) {
  return null;
}

export function SignInButton({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SignUpButton({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: false as const,
    userId: null,
    sessionId: null,
    getToken: async () => null,
  };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: false as const, user: null };
}
