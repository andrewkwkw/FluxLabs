import React, { useState } from 'react';
import { User, Mail, Lock, Sparkles, ArrowLeft } from 'lucide-react';
import { Input } from './Input';
import { backend } from '../../services/backendService';
import { SETTINGS } from '../../config';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        if (SETTINGS.MOCK) {
            // In mock mode, use a default dummy credential to simplify login
            await backend.login('demo@fluxlabs.ai', 'mock-password');
        } else {
            await backend.login(email, password);
        }
      } else {
        await backend.register(name, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 relative">
        <button className="absolute top-8 left-8 text-gray-400 hover:text-white">
            <ArrowLeft size={24} />
        </button>

      <div className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center mb-4 text-black">
                <Sparkles size={24} fill="black" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
                {isLogin ? 'Selamat Datang' : 'Buat Akun'}
            </h2>
            <p className="text-gray-500 text-sm text-center">
                {isLogin 
                    ? 'Mulai petualangan kreatif Anda bersama FluxLabs' 
                    : 'Bergabung dengan FluxLabs dan mulai berkreasi'}
            </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <Input
              label="Nama"
              placeholder="Nama lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              icon={<User size={18} />}
              required={!isLogin}
            />
          )}

          {/* Show inputs only if NOT (Mock Mode AND Login Mode) */}
          {(!SETTINGS.MOCK || !isLogin) ? (
            <>
                <Input
                    label="Email"
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail size={18} />}
                    required
                />

                <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<Lock size={18} />}
                    required
                />
            </>
          ) : (
            <div className="bg-zinc-900/50 border border-white/10 rounded-lg p-4 mb-6 text-center">
                 <p className="text-gray-300 text-sm font-medium">Mode Mock</p>
                 <p className="text-gray-500 text-xs mt-1">Langsung masuk tanpa kredensial</p>
            </div>
          )}

            {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg hover:bg-gray-200 transition duration-200 mt-2 flex justify-center items-center"
          >
            {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
            ) : (
                isLogin ? 'Masuk' : 'Daftar'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
          <button
            onClick={() => {
                setIsLogin(!isLogin);
                setError('');
            }}
            className="text-white font-semibold hover:underline"
          >
            {isLogin ? 'Daftar' : 'Masuk'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;