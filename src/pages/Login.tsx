import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../lib/auth';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

type Mode = 'login' | 'signup' | 'forgot-password' | 'update-password';

export default function Login() {
  const { signIn, signUp, resetPassword, updatePassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');

  useEffect(() => {
    // Check if we are in password recovery mode
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setMode('update-password');
    }
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(
      mode === 'login' ? loginSchema : 
      mode === 'signup' ? signupSchema : 
      mode === 'forgot-password' ? forgotPasswordSchema :
      loginSchema // reuse loginSchema for password update validation
    ),
  });

  useEffect(() => {
    if (!loading && user && mode !== 'update-password') {
      navigate('/');
    }
  }, [user, loading, navigate, mode]);

  const onSubmit = async (values: any) => {
    try {
      if (mode === 'login') {
        await signIn(values.email, values.password);
        navigate('/');
      } else if (mode === 'signup') {
        await signUp(values.email, values.password);
        setMode('login');
        reset();
      } else if (mode === 'forgot-password') {
        await resetPassword(values.email);
        setMode('login');
        reset();
      } else if (mode === 'update-password') {
        await updatePassword(values.password);
        setMode('login');
        reset();
        // Clear hash after update
        window.location.hash = '';
      }
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    }
  };

  const toggleMode = (newMode: Mode) => {
    setMode(newMode);
    reset();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl dark:bg-slate-900 border border-green-100 dark:border-green-900/30">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-green-600 text-3xl font-bold text-white shadow-lg shadow-green-900/20">S</div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-600 dark:text-green-500">Authorized Access</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">SONALI ERP</h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {mode !== 'update-password' && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
              <input
                type="email"
                {...register('email')}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.email && <p className="mt-2 text-sm text-rose-600">{(errors.email as any).message}</p>}
            </label>
          )}

          {mode !== 'forgot-password' && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {mode === 'update-password' ? 'New Password' : 'Password'}
              <input
                type="password"
                {...register('password')}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.password && <p className="mt-2 text-sm text-rose-600">{(errors.password as any).message}</p>}
            </label>
          )}

          {mode === 'signup' && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirm Password
              <input
                type="password"
                {...register('confirmPassword')}
                className="mt-2 w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-rose-600">{(errors.confirmPassword as any).message}</p>
              )}
            </label>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => toggleMode('forgot-password')}
                className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-3xl bg-[#16a34a] px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-green-900/10 active:scale-95"
          >
            {loading ? 'Processing...' : 
              mode === 'login' ? 'Sign In to Portal' : 
              mode === 'signup' ? 'Create ERP Account' : 
              'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === 'login' ? (
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Don't have an account?{' '}
              <button
                onClick={() => toggleMode('signup')}
                className="font-bold text-green-600 hover:text-green-700 dark:text-green-400"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <button
              onClick={() => toggleMode('login')}
              className="text-sm font-bold text-green-600 hover:text-green-700 dark:text-green-400"
            >
              Back to Secure Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
