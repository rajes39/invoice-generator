import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { getLastBackup, createAndDownloadBackup } from '../services/backupService';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function BackupWarningBanner() {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: lastBackup, refetch } = useQuery({
    queryKey: ['last_backup_banner', user?.id],
    queryFn: () => getLastBackup(user!.id),
    enabled: !!user?.id,
  });

  const today = new Date().toISOString().split('T')[0];
  const isBackupTakenToday = lastBackup?.backup_date === today;

  if (isBackupTakenToday) return null;

  const handleBackupNow = async () => {
    if (!user) return;
    setIsDownloading(true);
    const toastId = toast.loading('Starting backup...');
    try {
      await createAndDownloadBackup(user.id);
      toast.success('Backup taken successfully', { id: toastId });
      refetch();
    } catch (error) {
      console.error('Backup failed:', error);
      toast.error('Backup failed', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-1 items-center">
          <span className="flex p-2 rounded-lg bg-amber-100 text-amber-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="ml-3 font-bold text-amber-800 text-sm truncate">
            <span className="md:hidden">Backup not taken today.</span>
            <span className="hidden md:inline">Today's backup not taken yet - Protect your data now.</span>
          </p>
        </div>
        <div className="order-3 mt-0 flex-shrink-0 w-full sm:order-2 sm:mt-0 sm:w-auto">
          <button
            onClick={handleBackupNow}
            disabled={isDownloading}
            className="flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-xs font-black uppercase tracking-widest text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all active:scale-95"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Backup Now
          </button>
        </div>
      </div>
    </div>
  );
}
