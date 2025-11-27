
import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Loader2, Zap, ArrowRight, Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import TermsOfService from './TermsOfService';
import EthicsGuidelines from './EthicsGuidelines';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'terms' | 'ethics'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // UX Magic: Handle "admin" username mapping
    let finalEmail = email.trim();
    if (finalEmail.toLowerCase() === 'admin') {
        finalEmail = 'admin@labzoon.com';
    }

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: finalEmail,
          password,
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
            setSuccessMsg("注册成功！请检查您的邮箱完成验证。");
            setMode('login'); // Switch to login view so they can login after verify
        } else {
             // Session exists, auto login will trigger via onAuthStateChange in App.tsx
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: finalEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '发生错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'terms') {
    return <TermsOfService onBack={() => setMode('login')} />;
  }

  if (mode === 'ethics') {
    return <EthicsGuidelines onBack={() => setMode('login')} />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-6xl mx-auto mb-6 shadow-xl animate-bounce">
                🐰
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2">LabZoon</h1>
            <p className="text-gray-500 font-medium">像玩游戏一样学习医学实验动物学</p>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-3xl p-8 shadow-sm">
            <div className="flex justify-center mb-8 border-b-2 border-gray-100 pb-4">
                <button 
                    onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
                    className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wide transition-colors ${mode === 'login' ? 'text-blue-500 border-b-2 border-blue-500 -mb-4.5' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    登录
                </button>
                <button 
                    onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                    className={`flex-1 pb-2 text-sm font-bold uppercase tracking-wide transition-colors ${mode === 'signup' ? 'text-blue-500 border-b-2 border-blue-500 -mb-4.5' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    注册账号
                </button>
            </div>

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
                {error && (
                    <div className="bg-red-50 text-red-500 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}
                
                {successMsg && (
                    <div className="bg-green-50 text-green-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-green-100 animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 size={16} /> {successMsg}
                    </div>
                )}

                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        required
                        placeholder="电子邮箱 (管理员可直接输入 admin)"
                        className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-colors outline-none font-bold text-gray-900 placeholder-gray-400"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="密码"
                        className="w-full pl-12 pr-12 py-4 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-colors outline-none font-bold text-gray-900 placeholder-gray-400"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="mt-4 bg-blue-500 text-white font-extrabold uppercase tracking-widest py-4 rounded-xl shadow-[0_4px_0_0_#2563eb] active:shadow-none active:translate-y-1 hover:bg-blue-400 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="animate-spin" /> : (mode === 'login' ? '开始学习' : '创建档案')}
                </button>
            </form>
        </div>
        
        <p className="text-center text-gray-400 text-xs mt-8">
            登录即代表同意 LabZoon 的<br/>
            <button onClick={() => setMode('ethics')} className="underline hover:text-gray-600">实验动物伦理准则</button>
            {' '}与{' '}
            <button onClick={() => setMode('terms')} className="underline hover:text-gray-600">服务条款</button>
        </p>
      </div>
    </div>
  );
}
