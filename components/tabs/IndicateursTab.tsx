

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { IndicateurManuel, ColumnDefinition, FormFieldConfig, AllData, ParametreItem, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, calculateKpiSet, logActivity } from '../../utils/helpers';
import { ChevronUpIcon, ChevronDownIcon, MinusIcon, ChartPieIcon } from '../Icons';
import { useToast } from '../ToastProvider';
import { KPI_CONFIGS } from '../../constants';

interface IndicateursTabProps {
  currentUser: User;
}

const ProgressBar: React.FC<{ value: number; max: number; unit?: string }> = ({ value, max, unit }) => {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const isOverTarget = value > max && max > 0;

    return (
        <div>
            <div className="flex justify-between mb-1 text-xs font-medium text-gray-600">
                <span>{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}{unit === '%' ? '%' : ''}</span>
                <span>Cible: {max.toLocaleString()}{unit === '%' ? '%' : ''}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                    className={`h-2.5 rounded-full ${isOverTarget ? 'bg-green-500' : 'bg-brand-primary'}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const KpiCard: React.FC<{ title: string, currentValue: string, targetValue?: string | number, unit?: string, description?: string, rawValue: number, rawTarget: number }> = 
({ title, currentValue, targetValue, unit, description, rawValue, rawTarget }) => {
    return (
        <div className="bg-white p-4 rounded-lg shadow-md flex flex-col justify-between space-y-3">
            <h4 className="font-semibold text-brand-dark">{title}</h4>
            <p className="text-3xl font-bold text-brand-primary">{currentValue}</p>
            {typeof rawTarget === 'number' && rawTarget > 0 && (
                 <ProgressBar value={rawValue} max={rawTarget} unit={unit} />
            )}
            {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
    );
};

const indicateurManuelFormConfig: FormFieldConfig<IndicateurManuel>[] = [
  { name: 'nom', label: 'Nom de l\'objectif', type: 'text', required: true, placeholder: 'Ex: Satisfaction client (sondage)' },
  { name: 'categorie', label: 'Catégorie', type: 'text', placeholder: 'Ex: Qualité, Marketing, RH' },
  { name: 'valeurCible', label: 'Valeur Cible', type: 'text', placeholder: 'Ex: 95% ou Objectif Atteint' },
  { name: 'valeurActuelle', label: 'Valeur Actuelle', type: 'text', required: true, placeholder: 'Ex: 92% ou En cours' },
  { name: 'unite', label: 'Unité', type: 'text', required: true, placeholder: 'Ex: %, €, etc.' },
  { name: 'dateEnregistrement', label: 'Date d\'enregistrement', type: 'date', required: true },
  { name: 'periodeReference', label: 'Période de Référence', type: 'text', placeholder: 'Ex: Juillet 2024, T3 2024' },
  { 
    name: 'tendance', 
    label: 'Tendance', 
    type: 'select', 
    options: [{ value: 'Hausse', label: 'Hausse' }, { value: 'Baisse', label: 'Baisse' }, { value: 'Stable', label: 'Stable' }],
    placeholder: 'Sélectionner tendance'
  },
  { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Notes additionnelles sur cet objectif' },
];

const IndicateursTab: React.FC<IndicateursTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { indicateursManuelsData: indicateursManuels, parametresData: parametres } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndicateur, setEditingIndicateur] = useState<IndicateurManuel | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedKpiForHistory, setSelectedKpiForHistory] = useState<IndicateurManuel | null>(null);
  
  const calculatedKpis = useMemo(() => calculateKpiSet(allData), [allData]);
  const automatedKpiParams = useMemo(() => parametres.filter(p => p.type === 'kpiReference'), [parametres]);

  const handleShowHistory = (kpi: IndicateurManuel) => {
    setSelectedKpiForHistory(kpi);
    setHistoryModalOpen(true);
  };
  
  const kpiHistory = useMemo(() => {
    if (!selectedKpiForHistory) return [];
    return indicateursManuels
      .filter(k => k.nom === selectedKpiForHistory.nom)
      .sort((a, b) => new Date(b.dateEnregistrement).getTime() - new Date(a.dateEnregistrement).getTime());
  }, [indicateursManuels, selectedKpiForHistory]);

  const indicateurManuelColumns: ColumnDefinition<IndicateurManuel>[] = [
    { 
      accessor: 'nom', Header: 'Nom',
      cell: (item) => (
        <button onClick={() => handleShowHistory(item)} className="text-brand-primary hover:text-brand-dark hover:underline focus:outline-none" title={`Voir l'historique pour "${item.nom}"`}>
          {item.nom}
        </button>
      )
    },
    { accessor: 'valeurActuelle', Header: 'Actuel' },
    { accessor: 'valeurCible', Header: 'Cible' },
    { accessor: 'unite', Header: 'Unité' },
    { accessor: 'dateEnregistrement', Header: 'Date', cell: (item) => formatDateForInput(item.dateEnregistrement) },
    { 
      accessor: 'tendance', Header: 'Tendance',
      cell: (item) => {
        if (!item.tendance) return <span className="text-gray-400">N/A</span>;
        const icon = item.tendance === 'Hausse' ? <ChevronUpIcon className="w-5 h-5 text-green-500" />
                   : item.tendance === 'Baisse' ? <ChevronDownIcon className="w-5 h-5 text-red-500" />
                   : <MinusIcon className="w-5 h-5 text-gray-500" />;
        return <div className="flex justify-center">{icon}</div>;
      }
    },
  ];

  const handleAddItem = useCallback(() => {
    setEditingIndicateur({
        id: '',
        nom: '',
        valeurActuelle: '',
        unite: '',
        dateEnregistrement: formatDateForInput(new Date().toISOString()),
    } as IndicateurManuel);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: IndicateurManuel) => {
    setEditingIndicateur({ ...item, dateEnregistrement: formatDateForInput(item.dateEnregistrement) });
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);
  
  const handleCloneItem = useCallback((item: IndicateurManuel) => {
    const clonedItem = { 
      ...item, 
      id: '',
      dateEnregistrement: formatDateForInput(new Date().toISOString()),
    };
    setEditingIndicateur(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = indicateursManuels.find(i => i.id === id);
    try {
      await deleteDoc(doc(db, "indicateursManuelsData", id));
      addToast('Indicateur supprimé.', 'success');
      if (itemToDelete) {
        logActivity({ type: 'Indicateur', description: `Indicateur manuel '${itemToDelete.nom}' supprimé.` }, currentUser);
      }
    } catch (error: any) {
      console.error("Error deleting indicator:", { code: error.code, message: error.message });
      addToast("Erreur lors de la suppression.", 'error');
    }
  };

  const handleFormSubmit = async (data: Partial<IndicateurManuel>) => {
    const { id, ...payload } = data;
    const isNew = modalMode !== 'edit';
    
    try {
      if (isNew) {
        await addDoc(collection(db, "indicateursManuelsData"), payload);
        addToast('Indicateur ajouté.', 'success');
        logActivity({ type: 'Indicateur', description: `Nouvel indicateur manuel '${payload.nom}' ajouté.` }, currentUser);
      } else {
        if (!editingIndicateur?.id) throw new Error("ID manquant pour la modification.");
        await updateDoc(doc(db, "indicateursManuelsData", editingIndicateur.id), payload);
        addToast('Indicateur modifié.', 'success');
        logActivity({ type: 'Indicateur', description: `Indicateur manuel '${payload.nom}' modifié.` }, currentUser);
      }
      setIsModalOpen(false);
      setEditingIndicateur(undefined);
    } catch(error: any) {
        console.error("Error saving indicator:", { code: error.code, message: error.message });
        addToast("Erreur lors de la sauvegarde.", 'error');
    }
  };

  const getActiveFormConfig = () => {
    let config = [...indicateurManuelFormConfig];
    if (modalMode !== 'add' && editingIndicateur) {
      config.unshift({ name: 'id', label: 'ID (Automatique)', type: 'text', disabled: true });
    }
    return config;
  };
  
  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner l\'Indicateur Manuel';
    return editingIndicateur && modalMode === 'edit' ? 'Modifier l\'Indicateur' : 'Ajouter un Indicateur Manuel';
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-brand-dark mb-4 flex items-center">
            <ChartPieIcon className="w-7 h-7 mr-2" />
            Indicateurs Automatisés (KPIs)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {KPI_CONFIGS.map(kpiConfig => {
            const kpiData = calculatedKpis.get(kpiConfig.key);
            const kpiParam = automatedKpiParams.find(p => p.kpiKey === kpiConfig.key);
            
            return (
              <KpiCard 
                key={kpiConfig.key}
                title={kpiParam?.nom || kpiConfig.label}
                currentValue={kpiData?.formatted || `0 ${kpiConfig.unit}`}
                unit={kpiConfig.unit === '%' || kpiConfig.unit === 'CAD' ? '' : kpiConfig.unit}
                targetValue={kpiParam?.valeur}
                description={kpiParam?.description || kpiConfig.description}
                rawValue={kpiData?.value || 0}
                rawTarget={typeof kpiParam?.valeur === 'number' ? kpiParam.valeur : (typeof kpiParam?.valeur === 'string' ? parseFloat(kpiParam.valeur) : 0)}
              />
            )
          })}
        </div>
      </div>

      <TabContentWrapper title="Objectifs et Indicateurs Manuels" onAddItem={handleAddItem} addButtonLabel="Ajouter Objectif Manuel">
        <DataTable data={indicateursManuels} columns={indicateurManuelColumns} onEdit={handleEditItem} onDelete={handleDeleteItem} onClone={handleCloneItem} />
      </TabContentWrapper>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingIndicateur(undefined); }}
        title={getModalTitle()}
      >
        <DataForm<IndicateurManuel>
          formConfig={getActiveFormConfig()}
          initialData={editingIndicateur}
          onSubmit={handleFormSubmit}
          onCancel={() => { setIsModalOpen(false); setEditingIndicateur(undefined); }}
          isEditMode={modalMode !== 'add'}
          allData={allData}
        />
      </Modal>

      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Historique pour "${selectedKpiForHistory?.nom}"`}
      >
        {selectedKpiForHistory && (
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valeur</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kpiHistory.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{formatDateForInput(entry.dateEnregistrement)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{entry.valeurActuelle} {entry.unite}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default IndicateursTab;