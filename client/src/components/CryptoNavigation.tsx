// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { Link, useLocation } from 'wouter';
import { BarChart3, Bot, GraduationCap, Crown, MessageSquare, ShoppingBag } from 'lucide-react';
import { useCryptoAuth } from '@/hooks/useCryptoAuth';
import { useQuery } from '@tanstack/react-query';

interface SubscriptionData {
  tier: string;
  canUseElliott: boolean;
  canUseAI: boolean;
}

const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname.includes('replit') || 
   window.location.hostname.includes('localhost') ||
   window.location.hostname.includes('127.0.0.1'));

export function CryptoNavigation() {
  const [location] = useLocation();
  const { tier: localTier, isAuthenticated, isLoading: authLoading } = useCryptoAuth();
  
  const { data: subData } = useQuery<SubscriptionData>({
    queryKey: ['/api/crypto/my-subscription'],
    enabled: isDevelopment || (!authLoading && isAuthenticated),
    staleTime: 30000,
  });
  
  const tier = subData?.tier || localTier || 'free';
  
  const getTierColor = (t: string) => {
    switch (t.toLowerCase()) {
      case 'elite': return 'text-purple-400 bg-purple-900/50';
      case 'pro': return 'text-yellow-400 bg-yellow-900/50';
      case 'intermediate': return 'text-blue-400 bg-blue-900/50';
      case 'beginner': return 'text-green-400 bg-green-900/50';
      default: return 'text-slate-400 bg-slate-800';
    }
  };
  
  const navItems: Array<{ path: string; icon: typeof ShoppingBag; label: string; badge?: string }> = [
    { path: '/crypto/feedback', icon: MessageSquare, label: 'Board' },
    { path: '/crypto/training', icon: GraduationCap, label: 'Training' },
    { path: '/cryptoindicators', icon: BarChart3, label: 'Charts' },
    { path: '/cryptoai', icon: Bot, label: 'AI' },
    { path: '/shop', icon: ShoppingBag, label: 'Shop', badge: 'New' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-around py-2 sm:py-3">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                href={item.path}
                data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <button
                  className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="relative">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {item.badge && !isActive ? (
                      <span
                        className="absolute -right-2.5 -top-1.5 rounded-full bg-[#00c4b4] px-1 text-[8px] font-bold uppercase leading-3 text-black"
                        aria-label={item.badge}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium">{item.label}</span>
                </button>
              </Link>
            );
          })}
          
          <Link href="/crypto/account" data-testid="tier-indicator" className="cursor-pointer">
            <button
              className={`flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${getTierColor(tier)}`}
            >
              <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-medium capitalize">{tier}</span>
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
