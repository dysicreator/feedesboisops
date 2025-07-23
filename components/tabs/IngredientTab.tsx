import React, { useState, useCallback, useMemo, useContext } from 'react';
import { IngredientAchete, ColumnDefinition, FormFieldConfig, SeuilIngredientGenerique, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, isDateApproaching, logActivity } from '../../utils/helpers';
import { ExclamationTriangleIcon, ClockIcon } from '../Icons';
import { useToast } from '../ToastProvider';

interface IngredientsAchetesTabProps {
  currentUser: User;
}

const getIngredientAcheteFormConfig = (isEdit: boolean): FormFieldConfig<IngredientAchete>[] => {
  const baseConfig: FormFieldConfig<IngredientAchete>[] = [
    { 
        name: 'ingredientRefId', 
        label: 'Ingrédient de Référence', 
        type: 'select', 
        required: true, 
        dynamicEntityType: 'parametresIngredientGeneriqueRef',
        valueFieldForDynamicOptions: 'id',
        labelFieldForDynamicOptions: 'nom',
        placeholder: 'Sélectionner un ingrédient du catalogue',
        disabled: isEdit,
        autoFillFields: [
            { sourceField: 'nom', targetFormField: 'nom' },
            { sourceField: 'unite', targetFormField: 'unite' },
        ]
    },
    { name: 'nom', label: 'Nom de l\'ingrédient (auto)', type: 'text', required: true, disabled: true },
    {
      name: 'type',
      label: 'Type d\'ingrédient',
      type: 'select',
      required: true,
      options: [
        { value: 'Plante séchée', label: 'Plante séchée' },
        { value: 'Huile végétale', label: 'Huile végétale' },
        { value: 'Huile essentielle', label: 'Huile essentielle' },
        { value: 'Cire', label: 'Cire' },
        { value: 'Beurre végétal', label: 'Beurre végétal' },
        { value: 'Conservateur', label: 'Conservateur' },
        { value: 'Autre', label: 'Autre' },
      ],
      placeholder: 'Sélectionner type'
    },
    { name: 'fournisseur', label: 'Fournisseur', type: 'text', placeholder: 'Ex: Nom Fournisseur SA' },
    { name: 'dateAchat', label: 'Date d\'achat', type: 'date' },
  ];

  const quantityConfig: FormFieldConfig<IngredientAchete>[] = isEdit ? [
      { name: 'quantiteInitiale', label: 'Quantité Initiale (Lot)', type: 'number', disabled: true, step: "0.001" },
      { name: 'quantiteRestante', label: 'Quantité Actuelle en Stock (Lot)', type: 'number', required: true, placeholder: 'Ex: 800', step: "0.001" },
  ] : [
      { name: 'quantiteInitiale', label: 'Quantité Achetée (Lot)', type: 'number', required: true, placeholder: 'Ex: 1000', step: "0.001" },
  ];

  const remainingConfig: FormFieldConfig<IngredientAchete>[] = [
    { name: 'unite', label: 'Unité (auto)', type: 'text', required: true, disabled: true },
    { name: 'coutUnitaire', label: 'Coût Unitaire (CAD / unité)', type: 'number', placeholder: 'Ex: 15.5', step: "0.001" },
    { name: 'numeroLotFournisseur', label: 'N° Lot Fournisseur', type: 'text', placeholder: 'Ex: LOT2024-XYZ' },
    { name: 'datePeremption', label: 'Date de Péremption', type: 'date' },
    { name: 'lieuStockage', label: 'Lieu de Stockage', type: 'text', placeholder: 'Ex: Étagère A1, Frigo' },
    { name: 'bio', label: 'Bio', type: 'checkbox' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return [...baseConfig, ...quantityConfig, ...remainingConfig];
};


const IngredientsAchetesTab: React.FC<IngredientsAchetesTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { ingredientsAchetesData: ingredients, seuilsIngredientsGeneriquesData } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientAchete | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();

  const ingredientAcheteColumns: ColumnDefinition<IngredientAchete>[] = [
    { accessor: 'nom', Header: 'Nom Ingrédient' },
    { accessor: 'numeroLotFournisseur', Header: 'Lot Fourn.'},
    { accessor: 'quantiteInitiale', Header: 'Qté Init.' },
    {
      accessor: 'quantiteRestante',
      Header: 'Qté Rest.',
      cell: (item) => {
        const seuilGenerique = seuilsIngredientsGeneriquesData.find(s => s.nomIngredient === item.nom);
        const totalStockGeneric = ingredients
            .filter(ing => ing.nom === item.nom)
            .reduce((sum, ing) => sum + (ing.quantiteRestante || 0), 0);

        let stockClass = '';
        let stockIcon = null;

        if (seuilGenerique && totalStockGeneric < seuilGenerique.seuilGlobal) {
            stockClass = totalStockGeneric <= (seuilGenerique.seuilGlobal / 2) ? 'text-red-700 font-bold' : 'text-amber-600 font-semibold';
            stockIcon = <ExclamationTriangleIcon className={`w-4 h-4 inline-block mr-1 ${stockClass}`} />;
        } else if (!seuilGenerique && item.quantiteInitiale > 0) { // Fallback if no generic seuil, use ratio for lot for minor visual cue
            const stockRatio = item.quantiteRestante / item.quantiteInitiale;
            if (stockRatio < 0.1) stockClass = 'text-amber-600'; // Minor warning for very low individual lot
        }
        if (item.quantiteRestante <= 0) stockClass = 'text-red-700 font-bold'; // Always critical if empty

        return <span className={stockClass}>{stockIcon}{item.quantiteRestante}</span>;
      }
    },
    { accessor: 'unite', Header: 'Unité' },
    { accessor: 'coutUnitaire', Header: 'Coût Unit. CAD', cell: (item) => item.coutUnitaire ? item.coutUnitaire.toFixed(3) : 'N/A'},
    {
      accessor: 'datePeremption',
      Header: 'Péremption',
      cell: (item) => {
        if (!item.datePeremption) return 'N/A';
        const seuilGenerique = seuilsIngredientsGeneriquesData.find(s => s.nomIngredient === item.nom);
        const daysAdvance = seuilGenerique?.joursAlertePeremption ?? 30; // Default to 30 days if not set
        let expiryClass = '';
        let expiryIcon = null;

        if (item.quantiteRestante > 0 && isDateApproaching(item.datePeremption, daysAdvance)) {
             const today = new Date(); today.setHours(0,0,0,0);
             const expiryDate = new Date(item.datePeremption); expiryDate.setHours(0,0,0,0);
             const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
             expiryClass = diffDays <= 0 ? 'text-red-700 font-bold' : (diffDays <= 7 ? 'text-red-600 font-semibold' : 'text-amber-600');
             expiryIcon = <ClockIcon className={`w-3 h-3 inline-block mr-1 ${expiryClass}`} />;
        }
        return <span className={expiryClass}>{expiryIcon}{formatDateForInput(item.datePeremption)}</span>;
      }
    },
  ];

  const handleAddItem = useCallback(() => {
    setEditingIngredient({
        id: '', 
        ingredientRefId: '',
        nom: '',
        type: 'Huile végétale', 
        quantiteInitiale: 0,
        unite: '', 
        bio: true,
        dateAchat: formatDateForInput(new Date().toISOString()),
    } as IngredientAchete);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: IngredientAchete) => {
     const itemToEdit = { 
      ...item, 
      dateAchat: formatDateForInput(item.dateAchat),
      datePeremption: formatDateForInput(item.datePeremption),
    };
    setEditingIngredient(itemToEdit);
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);
  
  const handleCloneItem = useCallback((item: IngredientAchete) => {
    const clonedItem = {
        ...item,
        id: '', // Clear ID
        numeroLotFournisseur: '', // Clear lot number, must be unique for a new lot
        quantiteRestante: item.quantiteInitiale, // New lot starts full
        dateAchat: formatDateForInput(new Date().toISOString()), // Default to today
        datePeremption: undefined, 
    };
    setEditingIngredient(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);


  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce lot d\'ingrédient acheté ?')) {
      const itemToDelete = ingredients.find(i => i.id === id);
      try {
        await deleteDoc(doc(db, "ingredientsAchetesData", id));
        addToast('Lot d\'ingrédient supprimé.', 'success');
        if(itemToDelete) {
          logActivity({ type: 'Ingrédient', description: `Lot d'ingrédient '${itemToDelete.nom}' (Lot Fourn: ${itemToDelete.numeroLotFournisseur}) supprimé.` }, currentUser);
        }
      } catch (error) {
        console.error("Error deleting ingredient:", error);
        addToast("Erreur lors de la suppression.", 'error');
      }
    }
  };

  const handleFormSubmit = async (data: Partial<IngredientAchete>) => {
    const { id, ...payload } = data;
    const isNew = modalMode !== 'edit';

    try {
      if (isNew) {
        const newIngredientLot = { ...payload, quantiteRestante: payload.quantiteInitiale };
        await addDoc(collection(db, "ingredientsAchetesData"), newIngredientLot);
        addToast('Nouveau lot d\'ingrédient ajouté.', 'success');
        logActivity({ type: 'Ingrédient', description: `Nouveau lot d'ingrédient '${data.nom}' (Lot Fourn: ${data.numeroLotFournisseur}) ajouté.` }, currentUser);
      } else {
        if (!editingIngredient?.id) throw new Error("ID manquant pour la modification.");
        await updateDoc(doc(db, "ingredientsAchetesData", editingIngredient.id), payload);
        addToast('Lot d\'ingrédient modifié.', 'success');
        logActivity({ type: 'Ingrédient', description: `Lot d'ingrédient '${data.nom}' (Lot Fourn: ${data.numeroLotFournisseur}) modifié.` }, currentUser);
      }
      setIsModalOpen(false);
      setEditingIngredient(undefined);
    } catch (error) {
      console.error("Error saving ingredient:", error);
      addToast("Erreur lors de la sauvegarde.", "error");
    }
  };

  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner le Lot d\'Ingrédient';
    return editingIngredient && modalMode === 'edit' ? 'Modifier le Lot d\'Ingrédient' : 'Ajouter un Lot d\'Ingrédient';
  }

  const isEditMode = modalMode === 'edit' && !!(editingIngredient && editingIngredient.id);

  return (
    <TabContentWrapper title="Gestion des Lots d'Ingrédients Achetés" onAddItem={handleAddItem} addButtonLabel="Ajouter Lot Ingrédient">
      <DataTable 
        data={ingredients} 
        columns={ingredientAcheteColumns} 
        onEdit={handleEditItem} 
        onDelete={handleDeleteItem}
        onClone={handleCloneItem} 
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingIngredient(undefined); }}
        title={getModalTitle()}
      >
        {isModalOpen && (
            <DataForm<IngredientAchete>
              formConfig={getIngredientAcheteFormConfig(isEditMode)}
              initialData={editingIngredient}
              onSubmit={handleFormSubmit}
              onCancel={() => { setIsModalOpen(false); setEditingIngredient(undefined); }}
              isEditMode={isEditMode}
              allData={allData}
            />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default IngredientsAchetesTab;