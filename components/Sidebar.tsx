
import React from 'react';
import { Home, Settings, User, Trophy } from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isAdmin?: boolean;
}

const NavButton = ({ label, icon, active, onClick }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex md:w-full flex-col md:flex-row items-center md:gap-4 p-2 md:px-4 md:py-3 rounded-xl transition-all duration-200 ${active ? 'bg-blue-50 text-blue-500 border-blue-200 border-2' : 'hover:bg-gray-100 text-gray-500 border-transparent border-2'}`}
  >
    {icon}
    <span className="text-xs md:text-sm font-bold uppercase tracking-wide mt-1 md:mt-0">{label}</span>
  </button>
);

export default function Sidebar({ activeTab, setActiveTab, isAdmin = false }: SidebarProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 md:relative md:w-64 md:border-r md:border-t-0 md:h-screen flex md:flex-col justify-around md:justify-start p-2 md:p-6 z-10">
        <div className="hidden md:block mb-8 px-4">
        <h1 className="text-2xl font-extrabold text-green-600 tracking-tight flex items-center gap-2">
            <span className="text-3xl">🐰</span> LabZoon
        </h1>
        </div>
        
        <NavButton label="学习" icon={<Home size={24} />} active={activeTab === 'learn'} onClick={() => setActiveTab('learn')} />
        <NavButton label="排行榜" icon={<Trophy size={24} />} active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} />
        
        {isAdmin && (
            <NavButton label="内容后台" icon={<Settings size={24} />} active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
        )}
        
        <NavButton label="我的档案" icon={<User size={24} />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
    </div>
  );
}
