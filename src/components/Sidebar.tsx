import React from 'react';
import {
  ShieldCheck,
  LogOut,
  ArrowRightLeft,
  Users,
  RefreshCw
} from 'lucide-react';
import { StaffUser } from '../types/index.ts';

interface SidebarProps {
  currentScreen: string;
  onSelectScreen: (screen: string) => void;
  currentUser: StaffUser | null;
  onLogout: () => void;
  onSwitchUser?: () => void;
  onOpenSync?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onSelectScreen,
  currentUser,
  onLogout,
  onSwitchUser,
  onOpenSync,
}) => {
  const isAdmin = currentUser?.role === 'Admin';

  const mainNav = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'members', label: 'Members' },
    { id: 'trainers', label: 'Trainers' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'payments', label: 'Payments' },
    { id: 'schedule', label: 'Class schedule' },
  ];

  // Admin exclusive navigation
  const adminNav = [
    { id: 'staff_control', label: 'Staff Control', icon: Users, badge: 'ADMIN' },
  ];

  const isAbhiram = currentUser?.username?.toLowerCase() === 'abhiram';

  const systemNav = [
    ...(isAbhiram ? [{ id: 'mysql', label: 'MySQL & JDBC' }] : []),
    { id: 'settings', label: 'Settings' },
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'CF';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <aside className="w-56 shrink-0 bg-[#1A1D21] border-r border-[#2C3034] p-4 flex flex-col justify-between h-screen sticky top-0 select-none">
      <div>
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 mb-8 px-1.5 cursor-pointer"
          onClick={() => onSelectScreen('dashboard')}
        >
          <div className="w-8 h-8 bg-[#C9FF3D] rounded-md flex items-center justify-center font-anton text-[#101214] text-lg shadow-sm">
            C
          </div>
          <div>
            <span className="font-anton tracking-wide text-lg text-[#EDEEEA] leading-tight block">
              C-FIT
            </span>
            <span className="text-[10px] text-[#5D6164] font-mono tracking-widest block uppercase -mt-1">
              GYM SYSTEM
            </span>
          </div>
        </div>

        {/* Main Operations Nav */}
        <nav className="space-y-0.5">
          {mainNav.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectScreen(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left border cursor-pointer ${
                  isActive
                    ? 'bg-[#212528] text-[#C9FF3D] border-[#2C3034]'
                    : 'text-[#9A9E9F] hover:bg-[#212528] hover:text-[#EDEEEA] border-transparent'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-[#C9FF3D]' : 'bg-[#5D6164]'
                  }`}
                />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin Exclusive: Staff Control Module */}
        {isAdmin && (
          <div className="mt-5">
            <div className="text-[10px] tracking-[1.5px] uppercase text-[#C9FF3D] mb-2 px-3 font-semibold flex items-center justify-between">
              <span>Admin Access</span>
              <ShieldCheck className="w-3 h-3 text-[#C9FF3D]" />
            </div>
            <nav className="space-y-0.5">
              {adminNav.map((item) => {
                const isActive = currentScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectScreen(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors text-left border cursor-pointer ${
                      isActive
                        ? 'bg-[#C9FF3D]/15 text-[#C9FF3D] border-[#C9FF3D]/40'
                        : 'text-[#EDEEEA] hover:bg-[#212528] hover:text-[#C9FF3D] border-[#2C3034]/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-3.5 h-3.5 text-[#C9FF3D]" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#C9FF3D]/20 text-[#C9FF3D] font-mono font-bold">
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* System Section */}
        <div className="text-[10px] tracking-[1.5px] uppercase text-[#5D6164] mt-5 mb-2 px-3 font-semibold">
          System
        </div>
        <nav className="space-y-0.5">
          {systemNav.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectScreen(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left border cursor-pointer ${
                  isActive
                    ? 'bg-[#212528] text-[#C9FF3D] border-[#2C3034]'
                    : 'text-[#9A9E9F] hover:bg-[#212528] hover:text-[#EDEEEA] border-transparent'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isActive ? 'bg-[#C9FF3D]' : 'bg-[#5D6164]'
                  }`}
                />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer / User Profile & Logout */}
      <div className="pt-4 border-t border-[#2C3034]">
        <div className="bg-[#212528] rounded-xl p-2.5 border border-[#2C3034] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1A1D21] border border-[#2C3034] flex items-center justify-center font-bold text-xs text-[#EDEEEA] shrink-0 font-mono">
              {getInitials(currentUser?.full_name)}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-[#EDEEEA] truncate leading-tight">
                {currentUser?.full_name || 'Staff Member'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                    currentUser?.role === 'Admin'
                      ? 'bg-[#C9FF3D]/20 text-[#C9FF3D]'
                      : 'bg-[#1A1D21] text-[#9A9E9F] border border-[#2C3034]'
                  }`}
                >
                  {currentUser?.role || 'Staff'}
                </span>
                <span className="text-[10px] text-[#5D6164] font-mono truncate">
                  @{currentUser?.username}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Log out of terminal"
            className="p-1.5 rounded-lg text-[#5D6164] hover:text-[#FF5F45] hover:bg-[#FF5F45]/15 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Switch Account - Take to Login Page */}
        {onSwitchUser && (
          <button
            onClick={onSwitchUser}
            className="mt-2 w-full py-1.5 px-2 bg-[#212528] hover:bg-[#2C3034] text-[#9A9E9F] hover:text-[#EDEEEA] rounded-lg text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#2C3034]"
            title="Switch account — take to login page"
          >
            <ArrowRightLeft className="w-3 h-3 text-[#C9FF3D]" />
            <span>Switch Account</span>
          </button>
        )}

        {/* DB Connected button - only accessible to Administrator */}
        {isAdmin && onOpenSync && (
          <button
            onClick={onOpenSync}
            className="mt-2.5 w-full px-2.5 py-1.5 bg-[#212528] hover:bg-[#2C3034] border border-[#2C3034] hover:border-[#C9FF3D]/40 rounded-lg flex items-center justify-between text-[10px] text-[#9A9E9F] hover:text-[#EDEEEA] transition-all cursor-pointer font-mono group"
            title="Open Database Tables & Records (Admin Only)"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C9FF3D] animate-pulse" />
              <span className="text-[#C9FF3D] font-bold">DB: Connected</span>
            </span>
            <span className="text-[9px] text-[#5D6164] group-hover:text-[#C9FF3D] flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" /> Tables
            </span>
          </button>
        )}

        <div className="mt-1 px-1 flex items-center justify-between text-[9px] text-[#5D6164] font-mono">
          <span>cfit.db (SQLite)</span>
          <span>{currentUser?.shift || 'On Duty'}</span>
        </div>
      </div>
    </aside>
  );
};
