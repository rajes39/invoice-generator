import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { createAndDownloadBackup, getBackupHistory, getLastBackup } from '../services/backupService';
import { 
  Download, 
  History, 
  Database, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function BackupRestore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: lastBackup, isLoading: isLastLoading } = useQuery({
    queryKey: ['last_backup', user?.id],
    queryFn: () => getLastBackup(user!.id),
    enabled: !!user?.id,
  });

  const { data: history = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ['backup_history', user?.id],
    queryFn: () => getBackupHistory(user!.id),
    enabled: !!user?.id,
  });

  const handleManualBackup = async () => {
    if (!user) return;
    setIsDownloading(true);
    const toastId = toast.loading('Preparing backup...');
    try {
      await createAndDownloadBackup(user.id);
      toast.success('Backup downloaded successfully', { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['last_backup'] });
      queryClient.invalidateQueries({ queryKey: ['backup_history'] });
    } catch (error) {
      console.error('Manual backup failed:', error);
      toast.error('Backup failed. Please check your connection.', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const isBackupToday = lastBackup?.backup_date === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Backup & Restore</h2>
          <p className="text-sm text-slate-500 font-medium">Secure your ERP data with automated daily backups.</p>
        </div>
        <button
          onClick={handleManualBackup}
          disabled={isDownloading}
          className="inline-flex items-center gap-2 justify-center rounded-3xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 shadow-lg disabled:opacity-50"
        >
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download Full Backup Now
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-2xl ${isBackupToday ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Backup Status</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Backup Taken</p>
              {isLastLoading ? (
                <div className="h-6 w-32 bg-slate-100 animate-pulse rounded mt-1"></div>
              ) : (
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {lastBackup ? new Date(lastBackup.backup_time).toLocaleString() : 'Never'}
                </p>
              )}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isBackupToday ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isBackupToday ? (
                <><CheckCircle2 className="w-3 h-3" /> Up to Date</>
              ) : (
                <><AlertCircle className="w-3 h-3" /> Backup Required</>
              )}
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-2xl bg-blue-100 text-blue-600">
              <History className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Backup History (Last 30 Days)</h3>
          </div>

          <div className="overflow-hidden">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                {isHistoryLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-300" />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No backup logs found.</td>
                  </tr>
                ) : (
                  history.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {log.backup_date}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {new Date(log.backup_time).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
