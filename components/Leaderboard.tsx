
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { UserProgress } from '../types';
import { Trophy, Medal, Crown, Loader2, Zap, AlertTriangle } from 'lucide-react';

interface LeaderboardEntry extends UserProgress {
    userId: string;
}

export default function Leaderboard({ currentUserId }: { currentUserId: string }) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                // Fetch all user progress
                // Note: Ensure RLS policy on 'user_progress' allows SELECT for authenticated users
                const { data, error } = await supabase
                    .from('user_progress')
                    .select('user_id, data')
                    .limit(50); // Get top 50

                if (error) {
                    if (error.code === '42501') {
                         throw new Error("权限不足：请更新数据库策略以允许查看排行榜。");
                    }
                    throw error;
                }

                if (data) {
                    // Parse and sort
                    const parsed: LeaderboardEntry[] = data.map((row: any) => ({
                        ...row.data,
                        userId: row.user_id
                    }));

                    // Sort by XP descending
                    const sorted = parsed.sort((a, b) => (b.xp || 0) - (a.xp || 0));
                    setEntries(sorted);
                }
            } catch (err: any) {
                console.error("Leaderboard fetch error:", err);
                setError(err.message || "无法加载排行榜");
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const getRankStyle = (index: number) => {
        switch (index) {
            case 0: return "bg-yellow-100 border-yellow-300 text-yellow-700"; // Gold
            case 1: return "bg-gray-100 border-gray-300 text-gray-600";     // Silver
            case 2: return "bg-orange-100 border-orange-300 text-orange-700"; // Bronze
            default: return "bg-white border-gray-100 text-gray-500";
        }
    };

    const getIcon = (index: number) => {
        switch (index) {
            case 0: return <Crown className="w-6 h-6 text-yellow-500 fill-yellow-500" />;
            case 1: return <Medal className="w-6 h-6 text-gray-400 fill-gray-400" />;
            case 2: return <Medal className="w-6 h-6 text-orange-400 fill-orange-400" />;
            default: return <span className="font-bold w-6 text-center">{index + 1}</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-2" />
                <p>正在计算排名...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">排行榜暂时不可用</h3>
                <p className="text-gray-500 mb-4">{error}</p>
                <p className="text-xs text-gray-400 max-w-md bg-gray-100 p-4 rounded-xl">
                    提示：请在 Supabase SQL Editor 中运行以下命令以开放读取权限：<br/>
                    <code className="block mt-2 font-mono text-blue-600 select-all">
                        drop policy "Users can read own progress" on user_progress;<br/>
                        create policy "Read all progress" on user_progress for select using (auth.role() = 'authenticated');
                    </code>
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8 pb-24">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center justify-center gap-2">
                    <Trophy className="text-yellow-500" /> 学霸排行榜
                </h2>
                <p className="text-gray-500 text-sm mt-1">与所有 LabZoon 学习者一较高下</p>
            </div>

            <div className="flex flex-col gap-3">
                {entries.map((entry, index) => {
                    const isCurrentUser = entry.userId === currentUserId;
                    const rankStyle = getRankStyle(index);
                    
                    return (
                        <div 
                            key={entry.userId}
                            className={`flex items-center p-4 rounded-2xl border-2 transition-all hover:scale-[1.01] ${isCurrentUser ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 ring-offset-2 z-10' : rankStyle}`}
                        >
                            <div className="w-12 flex-shrink-0 flex justify-center text-lg">
                                {getIcon(index)}
                            </div>
                            
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow mr-4 uppercase">
                                {(entry.email || entry.username || '?').charAt(0)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`font-bold truncate ${isCurrentUser ? 'text-blue-700' : 'text-gray-800'}`}>
                                    {entry.username || entry.email || '神秘用户'}
                                    {isCurrentUser && <span className="ml-2 text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">我</span>}
                                </h4>
                                <div className="text-xs text-gray-400 flex items-center gap-2">
                                    <span className="flex items-center gap-1">🔥 {entry.streak} 天连胜</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className="font-extrabold text-gray-800 flex items-center gap-1 text-lg">
                                    {entry.xp} <Zap size={16} className="text-yellow-500 fill-yellow-500" />
                                </span>
                                <span className="text-xs text-gray-400 font-bold uppercase">经验值</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {entries.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                    暂无数据，快去完成第一节课吧！
                </div>
            )}
        </div>
    );
}
