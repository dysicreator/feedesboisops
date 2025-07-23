
import React, { useState, useRef, useContext } from 'react';
import { TabKey, TabConfig, User } from '../types';
import { TAB_CONFIGS } from '../constants';
import { LeafIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowLeftStartOnRectangleIcon, SparklesIcon } from './Icons';
import { exportAllDataAsJSON, importAllDataFromJSON } from '../utils/storageUtils';
import { useToast } from './ToastProvider';
import { DataContext } from './DataContext';
import AIAssistant from './AIAssistant';

// Tab Component Imports
import AccueilTab from './tabs/AccueilTab';
import ParametresTab from './tabs/ParametresTab';
import TravailleursTab from './tabs/WorkerTab';
import IngredientsAchetesTab from './tabs/IngredientsAchetesTab';
import ConditionnementsTab from './tabs/ConditionnementsTab';
import IntrantsAgricolesTab from './tabs/IntrantsAgricolesTab';
import RecettesTab from './tabs/RecettesTab';
import CulturesTab from './tabs/CulturesTab';
import RecoltesTab from './tabs/RecoltesTab';
import EtapesTransformationTab from './tabs/EtapesTransformationTab';
import LotsFabricationTab from './tabs/ProductionTab';
import IndicateursTab from './tabs/IndicateursTab';
import TableauDeBordTab from './tabs/TableauDeBordTab';
import VentesEtStockPFTab from './tabs/VentesEtStockPFTab';
import RapportsTab from './tabs/RapportsTab';
import DocumentationTab from './tabs/DocumentationTab';

interface AppContentProps {
    currentUser: User;
    onLogout: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_CONFIGS[0].key);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { allData, isLoading } = useContext(DataContext);

  const handleExportData = () => {
    exportAllDataAsJSON(allData, addToast);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importAllDataFromJSON(file, addToast);
    }
    if(event.target) {
        event.target.value = "";
    }
  };

  const renderTabContent = () => {
    if (isLoading) {
        return <div className="p-6 text-center text-gray-500">Chargement des données depuis le cloud...</div>;
    }

    // Pass currentUser to all tabs that need it
    switch (activeTab) {
      case 'accueil':
        return <AccueilTab setActiveTab={setActiveTab} />;
      case 'parametres':
        return <ParametresTab currentUser={currentUser} />;
      case 'travailleurs':
        return <TravailleursTab currentUser={currentUser} />;
      case 'ingredientsAchetes':
        return <IngredientsAchetesTab currentUser={currentUser} />;
      case 'conditionnements':
        return <ConditionnementsTab currentUser={currentUser} />;
      case 'intrantsAgricoles':
        return <IntrantsAgricolesTab currentUser={currentUser} />;
      case 'recettes':
        return <RecettesTab currentUser={currentUser} />;
      case 'cultures':
        return <CulturesTab currentUser={currentUser} />;
      case 'recoltes':
        return <RecoltesTab currentUser={currentUser} />;
      case 'etapesTransformation':
        return <EtapesTransformationTab currentUser={currentUser} />;
      case 'lotsFabrication':
        return <LotsFabricationTab currentUser={currentUser} />;
      case 'ventesEtStockPF': 
        return <VentesEtStockPFTab currentUser={currentUser} />;
      case 'indicateurs':
        return <IndicateursTab currentUser={currentUser} />;
      case 'rapports':
        return <RapportsTab />;
      case 'documentation':
        return <DocumentationTab />;
      case 'tableauDeBord':
        return <TableauDeBordTab setActiveTab={setActiveTab} currentUser={currentUser} />;
      default:
        return <div className="p-6 text-gray-700">Sélectionnez un onglet pour afficher le contenu.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-white text-brand-dark">
      <header className="bg-brand-primary shadow-md">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center">
            <LeafIcon className="h-10 w-10 text-brand-secondary mr-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Herboristerie La Fée des Bois
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-white text-sm hidden md:inline">Bonjour, {currentUser.nom}</span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              title="Importer des données (fichier JSON)"
              className="p-2 text-white bg-brand-primary hover:bg-brand-dark rounded-md shadow-sm transition-colors flex items-center border border-white/50 hover:border-white"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleExportData}
              title="Télécharger toutes les données (sauvegarde JSON)"
              className="p-2 text-white bg-brand-primary hover:bg-brand-dark rounded-md shadow-sm transition-colors flex items-center border border-white/50 hover:border-white"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
             <button
              onClick={onLogout}
              title="Déconnexion"
              className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors flex items-center border border-white/50 hover:border-white"
            >
              <ArrowLeftStartOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <nav className="bg-brand-dark">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-1 sm:space-x-0 md:space-x-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-brand-primary scrollbar-track-brand-dark">
              {TAB_CONFIGS.map((tab: TabConfig) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 px-2 py-3 sm:px-3 text-xs sm:text-sm font-medium rounded-t-md transition-colors duration-150 whitespace-nowrap
                    ${activeTab === tab.key
                      ? 'bg-white text-brand-primary border-brand-primary border-b-2'
                      : 'text-gray-300 hover:bg-brand hover:text-white'
                    }`}
                >
                  {tab.icon && <span className="mr-1 sm:mr-2 inline-block align-middle">{tab.icon}</span>}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {renderTabContent()}
      </main>
      
      {/* Floating AI Assistant Button */}
      <button
        onClick={() => setIsAiAssistantOpen(true)}
        className="fixed bottom-6 right-6 bg-brand-secondary text-white p-4 rounded-full shadow-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-transform transform hover:scale-110"
        title="Ouvrir l'assistant IA"
      >
        <SparklesIcon className="w-6 h-6" />
      </button>

      {/* AI Assistant Modal */}
      <AIAssistant 
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
      />

      <footer className="text-center py-4 text-sm text-gray-500 border-t border-gray-200 mt-8">
        &copy; {new Date().getFullYear()} Suivi Opérationnel Herboristerie La Fée des Bois.
      </footer>
    </div>
  );
};

export default AppContent;
