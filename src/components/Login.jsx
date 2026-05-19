import React, { useState } from 'react';
import { useShiftStore } from '../store/useShiftStore';
import { Mail, KeyRound, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import Logo from '../assets/S-Hub_logo.png';

export default function Login() {
  const { login } = useShiftStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. ログイン
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (authError) throw authError;

      // 2. Profile取得
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (fetchError) throw fetchError;

      // 3. ストアにログイン情報セット
      login({
        id: profile.id,
        name: profile.name,
        role: profile.role,
        companyId: profile.company_id,
        shopId: profile.shop_id,
        email: authData.user.email
      });
    } catch (err) {
      if (err.message.includes('Invalid login credentials')) {
        setErrorMsg('メールアドレスまたはパスワードが間違っています');
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-800 p-8 text-center border-b-4 border-blue-500">
          <img src={Logo} alt="S-Hub" className="h-10 mx-auto" />
          <p className="text-slate-400 mt-3 text-sm font-medium">シフト管理・スタッフポータル</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">

            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start text-sm mb-4 border border-red-200">
                <AlertCircle size={16} className="mr-2 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">パスワード</label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:bg-gray-400 mt-6"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              ※ アカウントの発行はシステム管理者にお問い合わせください
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100 font-bold flex items-center justify-center">
          <Lock size={12} className="mr-1" />
          Powered by Supabase Auth
        </div>
      </div>
    </div>
  );
}
