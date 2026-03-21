import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { currentTheme } from '../config/brand';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsLoading(true);

        try {
            const { error } = await login(email, password);
            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    setErrorMsg('Tên đăng nhập hoặc mật khẩu không đúng.');
                } else {
                    setErrorMsg(error.message);
                }
            }
            // If successful, AuthContext listener will update state, and App will re-render
        } catch (err) {
            console.error("Login Error:", err);
            setErrorMsg('Có lỗi xảy ra khi kết nối máy chủ.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-fade-in relative z-10">
                <div className="flex flex-col items-center gap-4 mb-8 p-8 pb-0">
                    {currentTheme.logo_url ? (
                        <div className="h-20 w-full max-w-[200px] flex items-center justify-center mb-1">
                            <img src={currentTheme.logo_url} alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-1">
                            <span className="material-symbols-outlined notranslate text-white text-3xl" translate="no">{currentTheme.logo_icon}</span>
                        </div>
                    )}
                    <div className="text-center">
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{currentTheme.company_name}</h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">Đăng nhập để truy cập hệ thống quản trị</p>
                    </div>
                </div>
                <div className="px-8 pb-8">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-3 animate-slide-in">
                            <span className="material-symbols-outlined notranslate" translate="no">error</span>
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 ml-1">Email / Tài khoản</label>
                            <div className="relative">
                                <span className="material-symbols-outlined notranslate absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" translate="no">mail</span>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                                    placeholder="admin@thanglong.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Mật khẩu</label>
                                <a href="#" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400">Quên mật khẩu?</a>
                            </div>
                            <div className="relative">
                                <span className="material-symbols-outlined notranslate absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" translate="no">lock</span>
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className={`
                                w-full mt-2 py-4 rounded-2xl font-black text-white text-sm shadow-xl transition-all flex items-center justify-center gap-2
                                ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/30 active:scale-95'}
                            `}
                        >
                            {isLoading ? (
                                <>
                                    <span className="material-symbols-outlined notranslate animate-spin" translate="no">progress_activity</span>
                                    Đang xác thực...
                                </>
                            ) : 'Đăng Nhập Hệ Thống'}
                        </button>
                    </form>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 text-center border-t border-slate-100 dark:border-slate-800">
                    <div className="text-xs text-slate-400 font-medium tracking-tight">
                        &copy; 2026 {currentTheme.company_name}. All rights reserved. <br/>
                        Core System by Sateco Software.
                    </div>
                </div>
            </div>

            {/* Background design elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]"></div>
                <div className="absolute top-1/2 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[80px]"></div>
            </div>
        </div>
    );
}
