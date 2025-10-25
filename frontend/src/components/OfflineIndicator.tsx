import React from 'react';
import { WifiOff } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

const OfflineIndicator: React.FC = () => {
  const { isOffline } = usePWA();

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-orange-100 border border-orange-200 rounded-lg shadow-lg p-3">
      <div className="flex items-center space-x-2">
        <WifiOff className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-medium text-orange-800">
          Offline Mode
        </span>
      </div>
      <p className="text-xs text-orange-700 mt-1">
        Some features may be limited
      </p>
    </div>
  );
};

export default OfflineIndicator;
