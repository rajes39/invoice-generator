import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { checkAndTriggerAutoBackup } from '../services/backupService';

export default function BackupAutoRunner() {
  const { user } = useAuth();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (user && !hasChecked.current) {
      hasChecked.current = true;
      checkAndTriggerAutoBackup(user.id);
    }
  }, [user]);

  return null;
}
