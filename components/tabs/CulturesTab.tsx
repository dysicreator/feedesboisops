

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Culture, ColumnDefinition, FormFieldConfig, AllData, Recolte, CoutIntrantUtilise, IntrantAgricole, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, calculateCultureCost, logActivity } from '../../utils/helpers';
import { useToast } from '../ToastProvider';

interface CulturesTabProps {
  currentUser: User;
}

const getCultureFormConfig = (): FormFieldConfig<Culture>[] => [
  {
    name: 'nomPlante',
    label: 'Plante de Base',
    type: 'select',
    required: true,
    dynamicEntityType: 'parametresCultureBase',
    labelFieldForDynamicOptions: 'nom',
    valueFieldForDynamicOptions: 'nom',
    placeholder: 'Sélectionner une plante depuis les paramètres',
  },
  { name: 'parcelle', label: 'Parcelle/Lieu de Culture', type: 'text', required: true, placeholder: 'Ex: A1-Nord, Serre 2' },
  { name: 'datePlantation', label: 'Date de Plantation/Début', type: 'date', required: true },
  {
    name: 'statut',
    label: 'Statut de la Culture',
    type: 'select',
    required: true,
    options: [
      { value: 'En culture', label: 'En culture' },
      { value: 'Terminée', label: 'Terminée (entièrement récoltée)' },
      { value: 'Échouée', label: 'Échouée (perdue)' },
    ],
    placeholder: 'Sélectionner le statut',
  },
  {
    name: 'travailleurs' as any,
    label: 'Travailleurs Impliqués (Culture)',
    type: 'nested_list_stub',
    subFormConfig: [
      {
        name: 'travailleurId', label: 'Travailleur', type: 'select', dynamicEntityType: 'travailleurs',
        labelFieldForDynamicOptions: 'nom', required: true, autoFillFields: [{sourceField: 'nom', targetFormField: 'nomTravailleur'}]
      },
      { name: 'nomTravailleur', label: 'Nom (auto)', type: 'text', disabled: true },
      { 
          name: 'activite', label: 'Activité de Culture', type: 'select', required: true,
          options: [
              {value: 'Préparation sol', label: 'Préparation sol'},
              {value: 'Plantation', label: 'Plantation'},
              {value: 'Entretien', label: 'Entretien'},
              {value: 'Désherbage', label: 'Désherbage'},
              {value: 'Autre (Culture)', label: 'Autre (Culture)'},
          ]
      },
      { name: 'dateActivite', label: 'Date Activité', type: 'date', required: true },
      { name: 'heures', label: 'Heures Travaillées', type: 'number', step: "0.1", required: true },
    ],
    defaultItem: { _tempId: '', travailleurId: '', nomTravailleur: '', activite: 'Entretien', heures: 0, dateActivite: formatDateForInput(new Date().toISOString()) }
  },
  {
    name: 'intrantsUtilises' as any,
    label: 'Intrants Agricoles Utilisés (Culture)',
    type: 'nested_list_stub',
    subFormConfig: [
        {
            name: 'intrantId', label: 'Intrant (Lot)', type: 'select', dynamicEntityType: 'intrantsAgricoles',
            labelFieldForDynamicOptions: (intrant: IntrantAgricole) => `${intrant.nom} (Lot: ${intrant.numeroLotFournisseur || intrant.id.substring(0,6)}) - Stock: ${intrant.quantiteRestante} ${intrant.unite || ''}`,
            required: true,
            secondaryFilter: (intrant: IntrantAgricole, currentSubFormItemData: CoutIntrantUtilise) => (currentSubFormItemData && intrant.id === currentSubFormItemData.intrantId) || intrant.quantiteRestante > 0,
            autoFillFields: [
                { sourceField: 'nom', targetFormField: 'nomIntrant'},
                { sourceField: 'unite', targetFormField: 'uniteUtilisation'}
            ]
        },
        { name: 'nomIntrant', label: 'Nom (auto)', type: 'text', disabled: true},
        { name: 'dateUtilisation', label: 'Date d\'Utilisation', type: 'date', required: true },
        { name: 'quantiteUtilisee', label: 'Quantité Utilisée', type: 'number', step: "0.01", required: true },
        { name: 'uniteUtilisation', label: 'Unité (auto)', type: 'text', disabled: true },
    ],
    defaultItem: { _tempId: '', intrantId: '', nomIntrant: '', quantiteUtilisee: 0, uniteUtilisation: '', dateUtilisation: formatDateForInput(new Date().toISOString()) }
  },
  { 
    name: 'coutProductionCultureEstime' as any,
    label: 'Coût de Production de la Culture (Estimé)',
    type: 'readonly_calculated',
    calculationFn: (formData, allData) => {
        const cost = calculateCultureCost(formData, allData);
        return cost > 0 ? `${cost.toFixed(2)} CAD` : '0.00 CAD';
    },
    dependsOn: ['travailleurs', 'intrantsUtilises']
  },
  { name: 'notes', label: 'Notes sur la culture', type: 'textarea' },
];

export const CulturesTab: React.FC<CulturesTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { culturesData: cultures } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();
  
  const cultureColumns: ColumnDefinition<Culture>[] = [
    { accessor: 'nomPlante', Header: 'Plante', getSearchValue: item => item.nomPlante },
    { accessor: 'parcelle', Header: 'Parcelle', getSearchValue: item => item.parcelle },
    { accessor: 'datePlantation', Header: 'Date Plantation', cell: (item) => formatDateForInput(item.datePlantation), getSearchValue: item => item.datePlantation },
    {
      accessor: (item, currentAllData) => {
        const recoltesAssociees = (currentAllData || allData).recoltesData.filter(r => r.cultureId === item.id).length;
        return recoltesAssociees;
      },
      Header: 'Nb. Récoltes',
    },
    {
      accessor: (item, currentAllData) => {
        const cost = calculateCultureCost(item, currentAllData || allData);
        return cost > 0 ? `${cost.toFixed(2)} CAD` : 'N/A';
      },
      Header: 'Coût Prod. Est.',
      getSearchValue: (item, currentAllData) => String(calculateCultureCost(item, currentAllData || allData)),
    },
    { accessor: 'statut', Header: 'Statut', getSearchValue: item => item.statut },
  ];

  const handleAddItem = useCallback(() => {
    setEditingCulture({
      id: '',
      nomPlante: '',
      parcelle: '',
      datePlantation: formatDateForInput(new Date().toISOString()),
      statut: 'En culture',
      travailleurs: [],
      intrantsUtilises: [],
    } as Culture);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: Culture) => {
    setEditingCulture({ 
        ...item, 
        datePlantation: formatDateForInput(item.datePlantation),
        travailleurs: item.travailleurs?.map(t => ({...t, _tempId: 'temp-'+Math.random(), dateActivite: formatDateForInput(t.dateActivite)})) || [],
        intrantsUtilises: item.intrantsUtilises?.map(i => ({...i, _tempId: 'temp-'+Math.random(), dateUtilisation: formatDateForInput(i.dateUtilisation)})) || [],
    });
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);

  const handleCloneItem = useCallback((item: Culture) => {
    const clonedItem = {
      ...item,
      id: '',
      parcelle: `${item.parcelle} (Copie)`,
      datePlantation: formatDateForInput(new Date().toISOString()),
      statut: 'En culture' as Culture['statut'],
      travailleurs: item.travailleurs?.map(t => ({ ...t, _tempId: 'temp-'+Math.random() })) || [],
      intrantsUtilises: item.intrantsUtilises?.map(i => ({ ...i, _tempId: 'temp-'+Math.random() })) || [],
    };
    setEditingCulture(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = cultures.find(c => c.id === id);
    try {
      await deleteDoc(doc(db, "culturesData", id));
      addToast('Culture supprimée.', 'success');
      if (itemToDelete) {
        logActivity({ type: 'Culture', description: `Culture de '${itemToDelete.nomPlante}' supprimée.` }, currentUser);
      }
    } catch(error: any) {
      console.error("Error deleting culture:", { message: error.message, code: error.code });
      addToast("Erreur lors de la suppression.", 'error');
    }
  };

  const handleFormSubmit = async (data: Partial<Culture>) => {
    const { id, ...payload } = data;
    const isNew = modalMode === 'add' || modalMode === 'clone';

    payload.coutProductionCultureEstime = calculateCultureCost(payload, allData);
    payload.travailleurs = payload.travailleurs?.map(t => { const {_tempId, ...rest} = t; return rest; }) || [];
    payload.intrantsUtilises = payload.intrantsUtilises?.map(i => { const {_tempId, ...rest} = i; return rest; }) || [];

    try {
      if (isNew) {
        const docRef = await addDoc(collection(db, "culturesData"), payload);
        logActivity({ type: 'Culture', description: `Nouvelle culture de ${payload.nomPlante} ajoutée.`, tabKey: 'cultures', itemId: docRef.id }, currentUser);
        addToast('Culture ajoutée.', 'success');
      } else {
        if (!editingCulture?.id) throw new Error("ID manquant pour la modification.");
        await updateDoc(doc(db, "culturesData", editingCulture.id), payload);
        logActivity({ type: 'Culture', description: `Culture de ${payload.nomPlante} modifiée.`, tabKey: 'cultures', itemId: editingCulture.id }, currentUser);
        addToast('Culture modifiée.', 'success');
      }
      setIsModalOpen(false);
      setEditingCulture(undefined);
    } catch(error: any) {
        console.error("Error saving culture:", { message: error.message, code: error.code });
        addToast("Erreur lors de la sauvegarde.", 'error');
    }
  };

  const getActiveFormConfig = () => {
    let config = [...getCultureFormConfig()];
    if ((modalMode === 'edit' || modalMode === 'clone') && editingCulture) {
      config.unshift({ name: 'id', label: 'ID (Automatique)', type: 'text', disabled: true });
    }
    return config;
  };

  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner la Culture';
    return editingCulture && modalMode === 'edit' ? 'Modifier la Culture' : 'Ajouter une Culture';
  };

  return (
    <TabContentWrapper title="Suivi des Cultures" onAddItem={handleAddItem} addButtonLabel="Ajouter Culture">
      <DataTable data={cultures} columns={cultureColumns} onEdit={handleEditItem} onDelete={handleDeleteItem} onClone={handleCloneItem} />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCulture(undefined); }}
        title={getModalTitle()}
      >
        {isModalOpen && (
          <DataForm<Culture>
            formConfig={getActiveFormConfig()}
            initialData={editingCulture}
            onSubmit={handleFormSubmit}
            onCancel={() => { setIsModalOpen(false); setEditingCulture(undefined); }}
            isEditMode={modalMode !== 'add'}
            allData={allData}
          />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default CulturesTab;