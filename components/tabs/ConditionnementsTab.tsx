

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Conditionnement, ColumnDefinition, FormFieldConfig, SeuilConditionnement, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, logActivity } from '../../utils/helpers';
import { ExclamationTriangleIcon } from '../Icons';
import { useToast } from '../ToastProvider';

interface ConditionnementsTabProps {
  currentUser: User;
}

const getConditionnementFormConfig = (isEdit: boolean): FormFieldConfig<Conditionnement>[] => {
  const baseConfig: FormFieldConfig<Conditionnement>[] = [
    { 
        name: 'conditionnementRefId', 
        label: 'Conditionnement de Référence', 
        type: 'select', 
        required: true, 
        dynamicEntityType: 'parametresConditionnementRef',
        placeholder: 'Sélectionner un conditionnement du catalogue',
        disabled: isEdit,
        autoFillFields: [
            { sourceField: 'nom', targetFormField: 'nom' },
        ]
    },
    { name: 'nom', label: 'Nom du Conditionnement (auto)', type: 'text', required: true, disabled: true },
    { 
      name: 'type', 
      label: 'Type', 
      type: 'select', 
      required: true,
      options: [
        { value: 'Pot', label: 'Pot' },
        { value: 'Flacon', label: 'Flacon' },
        { value: 'Sachet', label: 'Sachet' },
        { value: 'Bouteille', label: 'Bouteille' },
        { value: 'Etiquette', label: 'Étiquette' },
        { value: 'Autre', label: 'Autre' },
      ],
      placeholder: 'Sélectionner type'
    },
    { name: 'matiere', label: 'Matière', type: 'text', placeholder: 'Ex: Verre, PET, Kraft' },
    { name: 'capacite', label: 'Capacité', type: 'number', step: "0.1" },
    { name: 'uniteCapacite', label: 'Unité Capacité', type: 'text', placeholder: 'Ex: ml, g, unité' },
    { name: 'fournisseur', label: 'Fournisseur', type: 'text' },
    { name: 'dateAchat', label: 'Date d\'achat', type: 'date' },
  ];

  const quantityConfig: FormFieldConfig<Conditionnement>[] = isEdit ? [
      { name: 'quantiteInitiale', label: 'Quantité Initiale (Lot)', type: 'number', disabled: true, step: "1" },
      { name: 'quantiteRestante', label: 'Quantité Actuelle en Stock (Lot)', type: 'number', required: true, placeholder: 'Ex: 80', step: "1" },
  ] : [
      { name: 'quantiteInitiale', label: 'Quantité Achetée (Lot)', type: 'number', required: true, placeholder: 'Ex: 100', step: "1" },
  ];

  const remainingConfig: FormFieldConfig<Conditionnement>[] = [
    { name: 'coutUnitaire', label: 'Coût Unitaire (CAD)', type: 'number', step: "0.01" },
    { name: 'referenceFournisseur', label: 'Référence Fournisseur', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];
  
  return [...baseConfig, ...quantityConfig, ...remainingConfig];
};


const ConditionnementsTab: React.FC<ConditionnementsTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { conditionnementsData: conditionnements, seuilsConditionnementsData } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConditionnement, setEditingConditionnement] = useState<Conditionnement | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();

  const conditionnementColumns: ColumnDefinition<Conditionnement>[] = useMemo(() => [
    { 
      accessor: 'nom', 
      Header: 'Nom',
      cell: (item, data) => {
        const currentAllData = data || allData;
        if (item.nom) return item.nom;
        const ref = currentAllData.parametresData.find(p => p.type === 'conditionnementRef' && p.id === item.conditionnementRefId);
        return ref?.nom || '—';
      },
      getSearchValue: (item, data) => {
        const currentAllData = data || allData;
        if (item.nom) return item.nom;
        const ref = currentAllData.parametresData.find(p => p.type === 'conditionnementRef' && p.id === item.conditionnementRefId);
        return ref?.nom || '';
      }
    },
    { accessor: 'quantiteInitiale', Header: 'Qté Init.' },
    { 
      accessor: 'quantiteRestante', 
      Header: 'Qté Rest.',
      cell: (item) => {
        const seuilGenerique = seuilsConditionnementsData.find(s => s.nomConditionnement === item.nom);
        const totalStockGeneric = conditionnements
            .filter(cond => cond.nom === item.nom)
            .reduce((sum, cond) => sum + (cond.quantiteRestante || 0), 0);
        
        let stockClass = '';
        let stockIcon = null;

        if (seuilGenerique && totalStockGeneric < seuilGenerique.seuilGlobal) {
          stockClass = totalStockGeneric <= seuilGenerique.seuilGlobal / 2 ? 'text-red-700 font-bold' : 'text-amber-600 font-semibold';
          stockIcon = <ExclamationTriangleIcon className={`w-4 h-4 inline-block mr-1 ${stockClass}`} />;
        }
        if (item.quantiteRestante <= 0) stockClass = 'text-red-700 font-bold';

        return <span className={stockClass}>{stockIcon}{item.quantiteRestante}</span>;
      }
    },
    { accessor: 'coutUnitaire', Header: 'Coût Unit. (CAD)', cell: (item) => item.coutUnitaire?.toFixed(2) || '' },
    { accessor: 'fournisseur', Header: 'Fournisseur' },
    { accessor: 'dateAchat', Header: 'Date Achat', cell: (item) => item.dateAchat ? formatDateForInput(item.dateAchat) : '' },
  ], [conditionnements, seuilsConditionnementsData, allData]);

  const handleAddItem = useCallback(() => {
    setEditingConditionnement({
      id: '',
      conditionnementRefId: '',
      nom: '',
      type: 'Pot',
      quantiteInitiale: 0,
      quantiteRestante: 0,
      dateAchat: formatDateForInput(new Date().toISOString()),
    } as Conditionnement);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: Conditionnement) => {
    setEditingConditionnement({...item, dateAchat: formatDateForInput(item.dateAchat)});
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);
  
  const handleCloneItem = useCallback((item: Conditionnement) => {
    const clonedItem = { 
      ...item, 
      id: '', 
      referenceFournisseur: '',
      quantiteRestante: item.quantiteInitiale, // New lot starts full
      dateAchat: formatDateForInput(new Date().toISOString()),
    };
    setEditingConditionnement(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = conditionnements.find(c => c.id === id);
    try {
      await deleteDoc(doc(db, "conditionnementsData", id));
      addToast('Lot de conditionnement supprimé.', 'success');
      if (itemToDelete) {
        logActivity({ type: 'Conditionnement', description: `Lot de conditionnement '${itemToDelete.nom}' (Réf: ${itemToDelete.referenceFournisseur}) supprimé.` }, currentUser);
      }
    } catch (error: any) {
      console.error("Error deleting packaging item:", { code: error.code, message: error.message });
      addToast("Erreur lors de la suppression.", 'error');
    }
  };

  const handleFormSubmit = async (data: Partial<Conditionnement>) => {
    const { id, ...payload } = data;
    const isNew = modalMode !== 'edit';

    if (payload.conditionnementRefId && !payload.nom) {
      const ref = allData.parametresData.find(p => p.id === payload.conditionnementRefId);
      if (ref) {
          payload.nom = ref.nom;
      }
    }

    try {
      if (isNew) {
        const newLot = { ...payload, quantiteRestante: payload.quantiteInitiale };
        await addDoc(collection(db, "conditionnementsData"), newLot);
        addToast('Nouveau lot de conditionnement ajouté.', 'success');
        logActivity({ type: 'Conditionnement', description: `Nouveau lot de conditionnement '${data.nom}' (Réf: ${data.referenceFournisseur}) ajouté.` }, currentUser);
      } else {
        if (!editingConditionnement?.id) throw new Error("ID manquant pour la modification.");
        await updateDoc(doc(db, "conditionnementsData", editingConditionnement.id), payload);
        addToast('Lot de conditionnement modifié.', 'success');
        logActivity({ type: 'Conditionnement', description: `Lot de conditionnement '${data.nom}' (Réf: ${data.referenceFournisseur}) modifié.` }, currentUser);
      }
      setIsModalOpen(false);
      setEditingConditionnement(undefined);
    } catch(error: any) {
        console.error("Error saving packaging item:", { code: error.code, message: error.message });
        addToast("Erreur lors de la sauvegarde.", 'error');
    }
  };
  
  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner le Lot de Conditionnement';
    return editingConditionnement && modalMode === 'edit' ? 'Modifier le Lot de Conditionnement' : 'Ajouter un Lot de Conditionnement';
  }

  const isEditMode = modalMode === 'edit' && !!(editingConditionnement && editingConditionnement.id);

  return (
    <TabContentWrapper title="Gestion des Lots de Conditionnements" onAddItem={handleAddItem} addButtonLabel="Ajouter Lot Conditionnement">
      <DataTable 
        data={conditionnements} 
        columns={conditionnementColumns} 
        onEdit={handleEditItem} 
        onDelete={handleDeleteItem}
        onClone={handleCloneItem}
        allData={allData}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingConditionnement(undefined); }}
        title={getModalTitle()}
      >
       {isModalOpen && (
        <DataForm<Conditionnement>
            formConfig={getConditionnementFormConfig(isEditMode)}
            initialData={editingConditionnement}
            onSubmit={handleFormSubmit}
            onCancel={() => { setIsModalOpen(false); setEditingConditionnement(undefined); }}
            isEditMode={isEditMode}
            allData={allData}
        />
       )}
      </Modal>
    </TabContentWrapper>
  );
};

export default ConditionnementsTab;