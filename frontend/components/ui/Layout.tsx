import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Home, Settings, HelpCircle, Bell, User as UserIcon } from 'lucide-react';
import { backend } from '../../services/backendService';
import { User } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onNavigateToSceneBuilder: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onNavigateToSceneBuilder }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 sticky top-0 bg-[#0a0a0a] z-50">
        <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="font-semibold text-white cursor-pointer hover:text-teal-400">Flow</span>
            <span>{'>'}</span>
            <span className="flex items-center gap-2">
                {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - 
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                <span className="text-[10px] cursor-pointer hover:text-white">✏️</span>
            </span>
            <span>{'>'}</span>
            <span 
                className="hover:text-white cursor-pointer hover:underline transition"
                onClick={onNavigateToSceneBuilder}
            >
                Scenebuilder
            </span>
        </div>

        <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/10 rounded-full transition"><Bell size={18} className="text-gray-400" /></button>
            <button className="p-2 hover:bg-white/10 rounded-full transition"><HelpCircle size={18} className="text-gray-400" /></button>
            
            <div className="relative" ref={profileMenuRef}>
                <button 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-black font-bold text-sm hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                    {user.name.charAt(0).toUpperCase()}
                </button>

                {showProfileMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5">
                            <p className="text-sm text-white font-medium truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <button 
                            onClick={onLogout} 
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2 transition"
                        >
                            <LogOut size={14} /> Keluar
                        </button>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
