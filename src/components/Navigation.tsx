'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Menu, X, Home, LayoutDashboard, Settings, BookOpen, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface User {
  id: string;
  email: string;
  subscription_tier: 'free' | 'paid';
  role?: string;
}

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    setIsMenuOpen(false);
  };

  const isActive = (path: string) => pathname === path;

  if (isLoading) {
    return null;
  }

  if (!user) {
    // Not logged in - show navigation with Features and Pricing links
    return (
      <nav className="bg-[#2a2a2a] border-b border-[#FFA500]/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logos/Asset 3@4x-8.png"
                alt="SnipIt"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-white">SnipIt</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <a
                href="#features"
                className="text-sm text-gray-400 hover:text-[#FFA500] transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm text-gray-400 hover:text-[#FFA500] transition-colors"
              >
                Pricing
              </a>
            </nav>
          </div>
        </div>
      </nav>
    );
  }

  // Logged in - show full navigation
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/topics', label: 'Topics', icon: BookOpen },
  ];

  // Add admin link if user is admin
  if (user.role === 'admin') {
    navItems.push({ path: '/admin', label: 'Admin', icon: Settings });
  }

  return (
    <nav className="bg-[#2a2a2a] border-b border-[#FFA500]/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Image
              src="/logos/Asset 3@4x-8.png"
              alt="SnipIt"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-white">SnipIt</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-[#FFA500]/20 text-[#FFA500]'
                      : 'text-gray-400 hover:text-white hover:bg-[#333333]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-[#333333]"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>

          {/* User Info & Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-gray-400">{user.email}</span>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                user.subscription_tier === 'paid'
                  ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {user.subscription_tier === 'paid' ? 'Pro' : 'Free'}
            </span>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-gray-400 hover:text-white transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-[#FFA500]/20 py-4">
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-[#FFA500]/20 text-[#FFA500]'
                        : 'text-gray-400 hover:text-white hover:bg-[#333333]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-[#333333]"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
              <div className="border-t border-[#FFA500]/20 pt-4 mt-4 px-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">{user.email}</span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.subscription_tier === 'paid'
                        ? 'bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/30'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {user.subscription_tier === 'paid' ? 'Pro' : 'Free'}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#333333] rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

