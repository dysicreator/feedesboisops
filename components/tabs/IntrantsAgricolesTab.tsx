

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { IntrantAgricole, ColumnDefinition, FormFieldConfig, SeuilIntrantAgricole, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, calculateIntrantAgricoleCoutUnitaire, logActivity } from '../../utils/helpers';
import { ExclamationTriangleIcon } from '../Icons';
import { useToast } from '../ToastProvider';

interface IntrantsAgricolesTabProps {
  currentUser: User;
}

const getIntrantAgricoleFormConfig = (isEdit: boolean): FormFieldConfig<IntrantAgricole>[] => {
  const baseConfig: FormFieldConfig<IntrantAgricole>[] = [
    {
      name: 'intrantRefId',
      label: 'Intrant de Référence',
      type: 'select',
      required: true,
      dynamicEntityType: 'parametresIntrantAgricoleRef',
      placeholder: 'Sélectionner un intrant du catalogue',
      disabled: isEdit,
      autoFillFields: [
        { sourceField: 'nom', targetFormField: 'nom' },
        { sourceField: 'unite', targetFormField: 'unite' },
        { sourceField: 'description', targetFormField: 'descriptionUsage' },
      ]
    },
    { name: 'nom', label: 'Nom de l\'intrant (auto)', type: 'text', required: true, disabled: true },
    { 
      name: 'type', 
      label: 'Type d\'intrant', 
      type: 'select', 
      required: true,
      options: [
        { value: 'Semence', label: 'Semence' },
        { value: 'Plant', label: 'Plant' },
        { value: 'Compost', label: 'Compost' },
        { value: 'Engrais', label: 'Engrais' },
        { value: 'Amendement', label: 'Amendement' },
        { value: 'TraitementPhyto', label: 'Traitement Phytosanitaire' },
        { value: 'Autre', label: 'Autre' },
      ],
      placeholder: 'Sélectionner type'
    },
    { name: 'fournisseur', label: 'Fournisseur', type: 'text' },
    { name: 'marque', label: 'Marque', type: 'text' },
    { name: 'descriptionUsage', label: 'Description/Usage (auto)', type: 'textarea', disabled: true },
    { name: 'dateAchat', label: 'Date d\'Achat', type: 'date' },
    { name: 'numeroLotFournisseur', label: 'N° Lot Fournisseur', type: 'text' },
  ];

  const quantityAndCostConfig: FormFieldConfig<IntrantAgricole>[] = isEdit ? [
      { name: 'quantiteInitiale', label: 'Quantité Achetée (Lot)', type: 'number', disabled: true, step: "0.01" },
      { name: 'quantiteRestante', label: 'Quantité Actuelle en Stock (Lot)', type: 'number', required: true, placeholder: 'Ex: 20', step: "0.01" },
      { name: 'coutTotalAchat', label: 'Coût Total Achat (CAD)', type: 'number', step: "0.01" },
  ] : [
      { name: 'quantiteInitiale', label: 'Quantité Achetée (Lot)', type: 'number', required: true, step: "0.01" },
      { name: 'coutTotalAchat', label: 'Coût Total Achat (CAD)', type: 'number', step: "0.01" },
  ];
  
  const remainingConfig: FormFieldConfig<IntrantAgricole>[] = [
    { name: 'unite', label: 'Unité (auto)', type: 'text', required: true, disabled: true },
    { 
        name: 'coutUnitaire' as any,
        label: 'Coût Unitaire Estimé (Formulaire)', 
        type: 'readonly_calculated',
        calculationFn: (formData) => {
          const cost = calculateIntrantAgricoleCoutUnitaire(formData);
          return cost > 0 ? cost.toFixed(3) + ` CAD / ${formData.unite || 'unité'}` : 'N/A';
        },
        dependsOn: ['coutTotalAchat', 'quantiteInitiale', 'unite']
    },
    { name: 'bioCompatible', label: 'Bio Compatible', type: 'checkbox' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return [...baseConfig, ...quantityAndCostConfig, ...remainingConfig];
};

const IntrantsAgricolesTab: React.FC<IntrantsAgricolesTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { intrantsAgricolesData: intrants, seuilsIntrantsAgricolesData: seuilsIntrantsData } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntrant, setEditingIntrant] = useState<IntrantAgricole | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();
  
  const intrantAgricoleColumns: ColumnDefinition<IntrantAgricole>[] = useMemo(() => [
    { 
      accessor: 'nom', 
      Header: 'Nom Intrant',
      cell: (item, data) => {
        const currentAllData = data || allData;
        if (item.nom) return item.nom;
        const ref = currentAllData.parametresData.find(p => p.type === 'intrantAgricoleRef' && p.id === item.intrantRefId);
        return ref?.nom || '—';
      },
      getSearchValue: (item, data) => {
        const currentAllData = data || allData;
        if (item.nom) return item.nom;
        const ref = currentAllData.parametresData.find(p => p.type === 'intrantAgricoleRef' && p.id === item.intrantRefId);
        return ref?.nom || '';
      }
    },
    { accessor: 'type', Header: 'Type' },
    { accessor: 'quantiteInitiale', Header: 'Qté Init.'},
    { 
      accessor: 'quantiteRestante', 
      Header: 'Qté Rest.',
      cell: (item) => {
        const seuilGenerique = seuilsIntrantsData.find(s => s.nomIntrant === item.nom);
        const totalStockGeneric = intrants
            .filter(intr => intr.nom === item.nom)
            .reduce((sum, intr) => sum + (intr.quantiteRestante || 0), 0);
        
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
    { accessor: 'unite', Header: 'Unité' },
    { 
      accessor: 'coutUnitaire', 
      Header: 'Coût Unit. (CAD)', 
      cell: (item) => item.coutUnitaire ? `${item.coutUnitaire.toFixed(3)}` : 'N/A'
    },
    { accessor: 'bioCompatible', Header: 'Bio Compat.', cell: (item) => item.bioCompatible ? 'Oui' : 'Non' },
    { accessor: 'dateAchat', Header: 'Date Achat', cell: (item) => item.dateAchat ? formatDateForInput(item.dateAchat) : 'N/A' },
  ], [intrants, seuilsIntrantsData, allData]);

  const handleAddItem = useCallback(() => {
    setEditingIntrant({
        id: '',
        intrantRefId: '',
        nom: '',
        type: 'Semence',
        quantiteInitiale: 0,
        quantiteRestante: 0,
        unite: 'unité',
        bioCompatible: true,
        dateAchat: formatDateForInput(new Date().toISOString()),
    } as IntrantAgricole);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: IntrantAgricole) => {
    const itemToEdit = { ...item, dateAchat: formatDateForInput(item.dateAchat) };
    setEditingIntrant(itemToEdit);
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);
  
  const handleCloneItem = useCallback((item: IntrantAgricole) => {
    const clonedItem = { 
        ...item, 
        id: '',
        numeroLotFournisseur: '', 
        quantiteRestante: item.quantiteInitiale, // A new lot starts full
        dateAchat: formatDateForInput(new Date().toISOString()),
    };
    setEditingIntrant(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const itemToDelete = intrants.find(i => i.id === id);
    try {
      await deleteDoc(doc(db, "intrantsAgricolesData", id));
      addToast('Lot d\'intrant supprimé.', 'success');
      if (itemToDelete) {
        logActivity({ type: 'Intrant', description: `Lot d'intrant '${itemToDelete.nom}' (Lot Fourn: ${itemToDelete.numeroLotFournisseur}) supprimé.` }, currentUser);
      }
    } catch (error: any) {
      console.error("Error deleting agricultural input:", { code: error.code, message: error.message });
      addToast("Erreur lors de la suppression.", 'error');
    }
  };

  const handleFormSubmit = async (data: Partial<IntrantAgricole>) => {
    const { id, ...payload } = data;
    const isNew = modalMode !== 'edit';
    
    if (payload.intrantRefId && !payload.nom) {
      const ref = allData.parametresData.find(p => p.id === payload.intrantRefId);
      if (ref) {
          payload.nom = ref.nom;
      }
    }
    payload.coutUnitaire = calculateIntrantAgricoleCoutUnitaire(payload);
    
    try {
      if (isNew) {
        const newLot: Omit<IntrantAgricole, 'id'> = {
            ...(payload as Omit<IntrantAgricole, 'id'>),
            quantiteRestante: payload.quantiteInitiale || 0,
        };
        await addDoc(collection(db, "intrantsAgricolesData"), newLot);
        addToast('Nouveau lot d\'intrant ajouté.', 'success');
        logActivity({ type: 'Intrant', description: `Nouveau lot d'intrant '${data.nom}' (Lot Fourn: ${data.numeroLotFournisseur}) ajouté.` }, currentUser);
      } else {
        if (!editingIntrant?.id) throw new Error("ID manquant pour la modification.");
        await updateDoc(doc(db, "intrantsAgricolesData", editingIntrant.id), payload);
        addToast('Lot d\'intrant modifié.', 'success');
        logActivity({ type: 'Intrant', description: `Lot d'intrant '${data.nom}' (Lot Fourn: ${data.numeroLotFournisseur}) modifié.` }, currentUser);
      }
      setIsModalOpen(false);
      setEditingIntrant(undefined);
    } catch(error: any) {
        console.error("Error saving agricultural input:", { code: error.code, message: error.message });
        addToast("Erreur lors de la sauvegarde.", 'error');
    }
  };

  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner le Lot d\'Intrant Agricole';
    return editingIntrant && modalMode === 'edit' ? 'Modifier le Lot d\'Intrant' : 'Ajouter un Lot d\'Intrant';
  }

  const isEditMode = modalMode === 'edit' && !!(editingIntrant && editingIntrant.id);

  return (
    <TabContentWrapper title="Gestion des Lots d'Intrants Agricoles" onAddItem={handleAddItem} addButtonLabel="Ajouter Lot d'Intrant">
      <DataTable 
        data={intrants} 
        columns={intrantAgricoleColumns} 
        onEdit={handleEditItem} 
        onDelete={handleDeleteItem}
        onClone={handleCloneItem}
        allData={allData}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingIntrant(undefined); }}
        title={getModalTitle()}
      >
        {isModalOpen && (
            <DataForm<IntrantAgricole>
                formConfig={getIntrantAgricoleFormConfig(isEditMode)}
                initialData={editingIntrant}
                onSubmit={handleFormSubmit}
                onCancel={() => { setIsModalOpen(false); setEditingIntrant(undefined); }}
                isEditMode={isEditMode}
                allData={allData}
            />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default IntrantsAgricolesTab;