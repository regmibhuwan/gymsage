import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface PWAInstallBannerProps {
  onClose?: () => void;
}

const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ onClose }) => {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleInstall = async () => {
    await installApp();
    handleClose();
  };

  // Don't show if not installable or already installed
  if (!isInstallable || isInstalled || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 md:left-auto md:right-4 md:max-w-sm">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Download className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900">
            Install GymSage
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Get quick access to your workouts with our mobile app
          </p>
          
          <div className="mt-3 flex space-x-2">
            <button
              onClick={handleInstall}
              className="flex-1 bg-blue-600 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Install
            </button>
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium px-3 py-2 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Later
            </button>
          </div>
        </div>
        
        <button
          onClick={handleClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
