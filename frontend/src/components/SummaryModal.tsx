import React from 'react';
import { X, BarChart3, Calendar } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  type: 'daily' | 'weekly';
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, summary, type }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                {type === 'daily' ? (
                  <Calendar className="h-5 w-5 text-blue-600" />
                ) : (
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {type === 'daily' ? 'Daily Workout Summary' : 'Weekly Workout Summary'}
                </h3>
                <p className="text-sm text-gray-500">
                  {type === 'daily' ? 'Your workout breakdown for today' : 'Your progress this week'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                {summary}
              </pre>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="btn-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
