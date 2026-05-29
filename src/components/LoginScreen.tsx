import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { Lock, Mail, FileSpreadsheet, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function LoginScreen({ onLoginSuccess, showToast }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      const emailTrimmed = email.trim().toLowerCase();
      const pwd = password;

      if (!emailTrimmed || !pwd) {
        showToast("Email and password fields are required", "error");
        setIsSubmitting(false);
        return;
      }

      // Read users list from localStorage or fallback to defaults
      const savedUsersJson = localStorage.getItem('invoice_users');
      const users = savedUsersJson ? JSON.parse(savedUsersJson) : [
        { email: 'admin@example.com', password: 'admin123' },
        { email: 'bandhanrajesh123@gmail.com', password: 'admin123' }
      ];

      if (isLogin) {
        // Login behavior
        const foundUser = users.find(
          (u: any) => u.email.toLowerCase() === emailTrimmed && u.password === pwd
        );

        if (foundUser) {
          localStorage.setItem('invoice_logged_in_user', JSON.stringify({ email: foundUser.email }));
          showToast("Welcome back! Logged in successfully.", "success");
          onLoginSuccess(foundUser.email);
        } else {
          showToast("Invalid credentials. Try admin@example.com / admin123", "error");
        }
      } else {
        // Signup behavior
        if (pwd.length < 6) {
          showToast("Password must be at least 6 characters long", "error");
          setIsSubmitting(false);
          return;
        }

        if (pwd !== confirmPassword) {
          showToast("Passwords do not match", "error");
          setIsSubmitting(false);
          return;
        }

        const userExists = users.some((u: any) => u.email.toLowerCase() === emailTrimmed);
        if (userExists) {
          showToast("An account with this email already exists", "error");
          setIsSubmitting(false);
          return;
        }

        const newUsers = [...users, { email: emailTrimmed, password: pwd }];
        localStorage.setItem('invoice_users', JSON.stringify(newUsers));
        localStorage.setItem('invoice_logged_in_user', JSON.stringify({ email: emailTrimmed }));
        showToast("Account successfully registered! Logged in automatically.", "success");
        onLoginSuccess(emailTrimmed);
      }
      setIsSubmitting(false);
    }, 600);
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 transition-all duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              SONALI ERP
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl p-8 shadow-xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
              {isLogin ? "Sign In" : "Create Account"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">
              {isLogin 
                ? "Enter your credentials to access the billing dashboard." 
                : "Fill in the details to create a new operator login."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-500/10 cursor-pointer flex justify-center items-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-1.5">
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  <span>{isLogin ? "Access Dashboard" : "Register Operator"}</span>
                </div>
              )}
            </button>
          </form>

          {/* Toggle Login/Signup Button */}
          <div className="mt-5 text-center">
            <button
              onClick={toggleAuthMode}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl p-3.5">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 block mb-1">
                Default Credentials:
              </span>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-mono">
                Email: <strong className="text-amber-900 dark:text-amber-250">admin@example.com</strong> <br />
                Password: <strong className="text-amber-900 dark:text-amber-250">admin123</strong>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
