import React, { useState } from 'react';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon, LightBulbIcon } from './Icons';

interface FeatureSpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps: { title?: string; content: string }[];
}

const FeatureSpotlightModal: React.FC<FeatureSpotlightModalProps> = ({ isOpen, onClose, title, steps }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose(); // Finish if on last step
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleCloseAndReset = () => {
    setCurrentStep(0);
    onClose();
  }

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col transform transition-all duration-300 ease-out">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-brand-light rounded-t-lg">
          <div className="flex items-center">
            <LightBulbIcon className="w-7 h-7 text-brand-secondary mr-3" />
            <h3 className="text-xl font-semibold text-brand-dark">{title}</h3>
          </div>
          <button
            onClick={handleCloseAndReset}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer la visite guidée"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-gray-700 overflow-y-auto min-h-[150px]">
          {step.title && <h4 className="text-lg font-medium text-brand-primary">{step.title}</h4>}
          <div dangerouslySetInnerHTML={{ __html: step.content }} className="text-sm leading-relaxed"></div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Étape {currentStep + 1} sur {steps.length}
          </div>
          <div className="space-x-3">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Précédent
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-primary border border-transparent rounded-md shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary flex items-center"
            >
              {currentStep === steps.length - 1 ? 'Terminer' : 'Suivant'}
              {currentStep < steps.length - 1 && <ArrowRightIcon className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureSpotlightModal;
