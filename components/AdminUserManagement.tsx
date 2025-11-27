
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Trash2, Plus, ShieldCheck, Mail, Loader2 } from 'lucide-react';

interface AdminUser {
    email: string;
    created_at: number;
}

export default function AdminUserManagement() {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState('');

    useEffect(() => {
        fetchAdmins();
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserEmail(data.user?.email || '');
        });
    }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('app_admins').select('*').order('created_at', { ascending: true });
        if (data) {
            setAdmins(data);
        }
        setLoading(false);
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim()) return;
        setIsAdding(true);

        // Normalize email logic from auth screen
        let emailToAdd = newEmail.trim();
        if (emailToAdd.toLowerCase() === 'admin') emailToAdd = 'admin@labzoon.com';

        const { error } = await supabase.from('app_admins').insert({
            email: emailToAdd,
            created_at: Date.now()
        });

        if (error) {
            console.error("Add Admin Error:", error);
            // Try to extract useful info even if 'message' is missing (which happens with 404s in some supabase-js versions)
            let errorMessage = error.message;
            const errObj = error as any;
            
            if (!errorMessage && (errObj.code === '404' || errObj.status === 404)) {
                errorMessage = "数据库表 'app_admins' 不存在 (404)";
            }
            if (!errorMessage && typeof error === 'object') {
                errorMessage = JSON.stringify(error);
            }

            if (errorMessage?.includes('404') || errorMessage?.includes('PGRST204')) {
                alert(`添加失败：数据库表 'app_admins' 似乎不存在。\n\n请刷新页面，系统将检测并提示您运行 SQL 初始化脚本。`);
            } else {
                alert('添加失败: ' + errorMessage);
            }
        } else {
            setNewEmail('');
            fetchAdmins();
        }
        setIsAdding(false);
    };

    const handleRemoveAdmin = async (email: string) => {
        if (!confirm(`确定要移除 ${email} 的管理员权限吗？`)) return;
        
        const { error } = await supabase.from('app_admins').delete().eq('email', email);
        if (error) {
            alert('移除失败: ' + error.message);
        } else {
            fetchAdmins();
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-gray-200 shadow-sm">
                <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">管理员权限管理</h3>
                        <p className="text-sm text-gray-500">只有列表中的用户可以访问“内容后台”。</p>
                    </div>
                </div>

                <form onSubmit={handleAddAdmin} className="mb-8">
                    <label className="block text-xs font-bold text-gray-700 mb-2">添加新的管理员</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text"
                                placeholder="输入用户邮箱 (或 'admin')"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full pl-10 p-3 border-2 border-gray-200 rounded-xl outline-none focus:border-pink-500 font-bold text-gray-700 placeholder-gray-300"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isAdding || !newEmail}
                            className="bg-pink-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            添加
                        </button>
                    </div>
                </form>

                <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-700 mb-2">现有管理员 ({admins.length})</label>
                    {loading ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-gray-300" /></div>
                    ) : (
                        admins.map((admin) => (
                            <div key={admin.email} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="text-green-500" size={20} />
                                    <span className={`font-bold ${admin.email === currentUserEmail ? 'text-blue-600' : 'text-gray-700'}`}>
                                        {admin.email}
                                        {admin.email === currentUserEmail && <span className="ml-2 text-[10px] bg-blue-100 px-2 py-0.5 rounded-full">It's You</span>}
                                        {admin.email === 'admin@labzoon.com' && <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Super Admin</span>}
                                    </span>
                                </div>
                                
                                {admin.email !== currentUserEmail && (
                                    <button 
                                        onClick={() => handleRemoveAdmin(admin.email)}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-2"
                                        title="移除权限"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
