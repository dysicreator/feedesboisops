import React, { useState, useCallback, useMemo, useContext } from 'react';
import { EtapeTransformation, ColumnDefinition, FormFieldConfig, Travailleur, AllData, Recolte, Culture, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, calculateEtapeTransformationCost, logActivity } from '../../utils/helpers';
import { useToast } from '../ToastProvider';

interface EtapesTransformationTabProps {
  currentUser: User;
}

const getEtapeTransformationFormConfig = (allData: AllData): FormFieldConfig<EtapeTransformation>[] => [
  { name: 'nomProcessus', label: 'Nom du Processus', type: 'text', required: true, placeholder: 'Ex: Séchage Lavande, Macération Huile Calendula' },
  {
    name: 'typeLotEntrant',
    label: 'Type de Lot Entrant',
    type: 'select',
    required: true,
    options: [
        {value: 'Recolte', label: 'Récolte'},
        {value: 'EtapeTransformationPrecedente', label: 'Étape de Transformation Précédente'}
    ],
    placeholder: 'Sélectionner le type de lot entrant'
  },
  {
    name: 'lotEntrantId',
    label: 'Lot Entrant (Récolte/Étape Préc.)',
    type: 'select',
    required: true,
    dynamicEntityType: 'recoltes', // Default, DataForm switches based on typeLotEntrant
    labelFieldForDynamicOptions: (entity: Recolte | EtapeTransformation, currentAllData?: AllData) => {
        const localAllData = currentAllData || allData;
        if ('cultureId' in entity) { // Recolte
            const recolte = entity as Recolte;
            const culture = localAllData.culturesData.find(c => c.id === recolte.cultureId);
            return `${culture?.nomPlante || 'N/A'} - Lot Récolte: ${recolte.lotNumero} (Stock: ${(recolte.poidsApresSechage || 0).toFixed(2)}${recolte.unitePoids || ''})`;
        }
        if ('lotSortantId' in entity) { // EtapeTransformation
            const etape = entity as EtapeTransformation;
             return `${etape.matiereSortanteDescription} - Lot Transfo: ${etape.lotSortantId} (Stock: ${(etape.quantiteSortante || 0).toFixed(2)}${etape.uniteSortante || ''})`;
        }
        return (entity as any).id;
    },
    filterContextField: 'typeLotEntrant',
    secondaryFilter: (item: any, formDataInScope) => {
        if (formDataInScope && (item.id === formDataInScope.lotEntrantId || item.lotSortantId === formDataInScope.lotEntrantId)) return true;

        if ('cultureId' in item) { // It's a Recolte
            return item.statut === 'Séchée' && (item.poidsApresSechage || 0) > 0;
        }
        if ('lotSortantId' in item) { // It's an EtapeTransformation
            return item.statut === 'Terminée' && (item.quantiteSortante || 0) > 0;
        }
        return false;
    },
    placeholder: 'Sélectionner le lot entrant',
    autoFillFields: [
         {
            sourceField: (entity: Recolte | EtapeTransformation, localAllData) => {
                if ('cultureId' in entity) {
                    const culture = localAllData?.culturesData.find(c => c.id === (entity as Recolte).cultureId);
                    return `${culture?.nomPlante || 'N/A'} - Lot: ${(entity as Recolte).lotNumero}`;
                }
                 if ('matiereSortanteDescription' in entity) return (entity as EtapeTransformation).matiereSortanteDescription + ` - Lot: ${(entity as EtapeTransformation).lotSortantId}`;
                 return '';
            },
            targetFormField: 'matiereEntranteDescription'
        },
        {
            sourceField: (entity: Recolte | EtapeTransformation) => {
                 if ('poidsApresSechage' in entity) return (entity as Recolte).poidsApresSechage;
                 if ('quantiteSortante' in entity) return (entity as EtapeTransformation).quantiteSortante;
                 return undefined;
            },
            targetFormField: 'quantiteEntrante'
        },
        {
            sourceField: (entity: Recolte | EtapeTransformation) => {
                 if ('poidsApresSechage' in entity) return (entity as Recolte).unitePoids;
                 if ('uniteSortante' in entity) return (entity as EtapeTransformation).uniteSortante;
                 return undefined;
            },
            targetFormField: 'uniteEntrante'
        }
    ]
  },
  { name: 'matiereEntranteDescription', label: 'Description Matière Entrante (auto)', type: 'text', placeholder: 'Ex: Lavande fraîche lot X', disabled: true },
  { name: 'quantiteEntrante', label: 'Qté Dispo. Lot Entrant (auto)', type: 'number', step: "0.01", disabled: true },
  { name: 'quantiteAUtiliser', label: 'Quantité à Utiliser de ce Lot Entrant', type: 'number', step: "0.01", required: true, placeholder: "Entrer la quantité à utiliser" },
  { name: 'uniteEntrante', label: 'Unité Entrante (auto)', type: 'text', placeholder: 'Ex: kg, L, bottes', disabled: true },
  { name: 'dateDebut', label: 'Date de Début', type: 'date', required: true },
  { name: 'dateFin', label: 'Date de Fin', type: 'date' },
  { name: 'matiereSortanteDescription', label: 'Description Matière Sortante (Auto-suggérée)', type: 'text', required: true, placeholder: 'Ex: Lavande séchée lot X-S1' },
  { name: 'quantiteSortante', label: 'Quantité Sortante', type: 'number', step: "0.01" },
  {
    name: 'uniteSortante',
    label: 'Unité Sortante',
    type: 'select', 
    dynamicEntityType: 'parametresUniteMesure',
    placeholder: 'Sélectionner unité sortante'
  },
  { name: 'lotSortantId', label: 'ID Lot Sortant (Unique, Auto-suggéré)', type: 'text', required: true, placeholder: 'Nouveau N° de lot pour matière transformée' },
  {
    name: 'travailleurs' as any,
    label: 'Travailleurs Impliqués (Transformation)',
    type: 'nested_list_stub',
    placeholder: 'Ajouter heures par travailleur',
    subFormConfig: [
      {
        name: 'travailleurId',
        label: 'Travailleur',
        type: 'select',
        dynamicEntityType: 'travailleurs',
        labelFieldForDynamicOptions: 'nom',
        required: true,
        autoFillFields: [{sourceField: 'nom', targetFormField: 'nomTravailleur'}]
      },
      { name: 'nomTravailleur', label: 'Nom (auto)', type: 'text', disabled: true },
      { name: 'heures', label: 'Heures', type: 'number', step: "0.1", required: true },
    ],
    defaultItem: { _tempId: '', travailleurId: '', nomTravailleur: '', heures: 0 }
  },
  { name: 'equipementUtilise', label: 'Équipement Utilisé', type: 'text', placeholder: 'Ex: Séchoir, Cuve inox' },
  { name: 'parametresControle', label: 'Paramètres de Contrôle', type: 'textarea', placeholder: 'Ex: Temp: 30°C, Humidité: <10%, Durée: 72h' },
  { name: 'pertesTransformation', label: 'Pertes Transformation', type: 'number', step: "0.01" },
  {
    name: 'unitePertes',
    label: 'Unité Pertes',
    type: 'select', 
    dynamicEntityType: 'parametresUniteMesure',
    placeholder: 'Sélectionner unité pertes'
  },
  {
    name: 'coutMatiereEntranteEstime',
    label: 'Coût Matière Entrante Est. (CAD)',
    type: 'readonly_calculated',
    calculationFn: (formData, data) => {
        const tempFormData = {...formData, quantiteEntrante: formData['quantiteAUtiliser' as keyof EtapeTransformation] as number || 0};
        return calculateEtapeTransformationCost(tempFormData, data || allData).coutMatiereEntranteEstime.toFixed(3);
    },
    dependsOn: ['lotEntrantId', 'typeLotEntrant', 'quantiteAUtiliser', 'travailleurs']
  },
  {
    name: 'coutTravailDeLEtape',
    label: 'Coût Travail de l\'Étape (CAD)',
    type: 'readonly_calculated',
    calculationFn: (formData, data) => calculateEtapeTransformationCost(formData, data || allData).coutTravailDeLEtape.toFixed(2),
    dependsOn: ['travailleurs']
  },
  {
    name: 'coutTotalEtapeEstime',
    label: 'Coût Total Étape Est. (CAD)',
    type: 'readonly_calculated',
    calculationFn: (formData, data) => {
        const tempFormData = {...formData, quantiteEntrante: formData['quantiteAUtiliser' as keyof EtapeTransformation] as number || 0};
        return calculateEtapeTransformationCost(tempFormData, data || allData).coutTotalEtapeEstime.toFixed(2);
    },
    dependsOn: ['lotEntrantId', 'typeLotEntrant', 'quantiteAUtiliser', 'travailleurs']
  },
  {
    name: 'coutUnitaireSortantEstime',
    label: 'Coût Unitaire Sortant Estimé (CAD)',
    type: 'readonly_calculated',
    calculationFn: (formData, data) => {
        const tempFormData = {...formData, quantiteEntrante: formData['quantiteAUtiliser' as keyof EtapeTransformation] as number || 0};
        const cost = calculateEtapeTransformationCost(tempFormData, data || allData).coutUnitaireSortantEstime;
        return cost > 0 && formData.quantiteSortante && formData.uniteSortante
               ? `${cost.toFixed(3)} / ${formData.uniteSortante}`
               : 'N/A';
    },
    dependsOn: ['lotEntrantId', 'typeLotEntrant', 'quantiteAUtiliser', 'travailleurs', 'quantiteSortante', 'uniteSortante']
  },
  {
    name: 'statut',
    label: 'Statut Étape',
    type: 'select',
    required: true,
    options: [
      { value: 'Planifiée', label: 'Planifiée' },
      { value: 'En cours', label: 'En cours' },
      { value: 'Terminée', label: 'Terminée (déduit stock entrant)' },
      { value: 'Annulée', label: 'Annulée' },
    ],
    placeholder: 'Sélectionner statut'
  },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

const EtapesTransformationTab: React.FC<EtapesTransformationTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { etapesTransformationData: etapes } = allData;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEtape, setEditingEtape] = useState<EtapeTransformation | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();

  const etapeTransformationColumns: ColumnDefinition<EtapeTransformation>[] = [
    { accessor: 'nomProcessus', Header: 'Processus', getSearchValue: item => item.nomProcessus },
    { accessor: 'lotEntrantId', Header: 'Lot Entrant ID', getSearchValue: item => item.lotEntrantId },
    { accessor: 'lotSortantId', Header: 'Lot Sortant ID', getSearchValue: item => item.lotSortantId },
    { accessor: 'dateDebut', Header: 'Début', cell: (item) => formatDateForInput(item.dateDebut), getSearchValue: item => item.dateDebut },
    {
      accessor: (item) => {
        const tempItem = {...item, quantiteEntrante: (item as any).quantiteAUtiliser || item.quantiteEntrante};
        const cost = calculateEtapeTransformationCost(tempItem, allData).coutUnitaireSortantEstime;
        return cost > 0 && item.quantiteSortante && item.uniteSortante
          ? `${cost.toFixed(3)} CAD/${item.uniteSortante || 'unité'}`
          : 'N/A';
      },
      Header: 'Coût Unit. Sortant Est.',
      getSearchValue: item => String(calculateEtapeTransformationCost(item, allData).coutUnitaireSortantEstime)
    },
    { accessor: 'statut', Header: 'Statut', getSearchValue: item => item.statut },
  ];

  const currentFormConfig = useMemo(() => getEtapeTransformationFormConfig(allData), [allData]);

  const handleAddItem = useCallback(() => {
    const today = new Date();
    const dateSuffix = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    setEditingEtape({
        id: '',
        nomProcessus: '',
        typeLotEntrant: 'Recolte',
        lotEntrantId: '',
        matiereEntranteDescription: '',
        matiereSortanteDescription: `Nouveau produit transformé`,
        dateDebut: formatDateForInput(today.toISOString()),
        lotSortantId: `TRANS-${dateSuffix}-` + Math.random().toString(36).substr(2, 4).toUpperCase(),
        travailleurs: [],
        statut: 'Planifiée',
    } as EtapeTransformation);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: EtapeTransformation) => {
    const itemToEdit = {
      ...item,
      dateDebut: formatDateForInput(item.dateDebut),
      dateFin: formatDateForInput(item.dateFin),
      travailleurs: item.travailleurs?.map(t => ({...t, _tempId: 'temp-'+Math.random()})) || [],
    };
    setEditingEtape(itemToEdit);
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);
  
  const handleCloneItem = useCallback((item: EtapeTransformation) => {
    const today = new Date();
    const dateSuffix = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const clonedItem = {
      ...item,
      id: '',
      lotSortantId: `${item.nomProcessus.substring(0,5).toUpperCase()}-${dateSuffix}-`+ Math.random().toString(36).substr(2, 4).toUpperCase(),
      dateDebut: formatDateForInput(today.toISOString()),
      dateFin: undefined,
      statut: 'Planifiée' as EtapeTransformation['statut'],
      coutMatiereEntranteEstime: undefined,
      coutTravailDeLEtape: undefined,
      coutTotalEtapeEstime: undefined,
      coutUnitaireSortantEstime: undefined,
      travailleurs: item.travailleurs?.map(t => ({ ...t, _tempId: 'temp-'+Math.random() })) || [],
    };
    setEditingEtape(clonedItem as EtapeTransformation);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const isUsedAsInput = etapes.some(et => et.lotEntrantId === id && et.typeLotEntrant === 'EtapeTransformationPrecedente');
    if (isUsedAsInput) {
        addToast("Suppression impossible: le lot sortant de cette étape est utilisé comme lot entrant dans une autre étape de transformation.", "error");
        return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette étape de transformation ? Si le stock du lot entrant avait été déduit, il sera recrédité.')) {
        const etapeToDelete = etapes.find(et => et.id === id);
        if (etapeToDelete && etapeToDelete.statut === 'Terminée') {
            const qtyToAdjust = etapeToDelete.quantiteEntrante || 0;
            const batch = writeBatch(db);
            if (etapeToDelete.typeLotEntrant === 'Recolte') {
                const recolteSource = allData.recoltesData.find(r => r.id === etapeToDelete.lotEntrantId);
                if(recolteSource) {
                    const docRef = doc(db, "recoltesData", recolteSource.id);
                    batch.update(docRef, { poidsApresSechage: (recolteSource.poidsApresSechage || 0) + qtyToAdjust });
                }
            } else if (etapeToDelete.typeLotEntrant === 'EtapeTransformationPrecedente') {
                 const etapeSource = etapes.find(et => et.lotSortantId === etapeToDelete.lotEntrantId);
                 if(etapeSource) {
                    const docRef = doc(db, "etapesTransformationData", etapeSource.id);
                    batch.update(docRef, { quantiteSortante: (etapeSource.quantiteSortante || 0) + qtyToAdjust });
                 }
            }
            await batch.commit();
        }
        await deleteDoc(doc(db, "etapesTransformationData", id));
        addToast("Étape de transformation supprimée.", 'success');
        if (etapeToDelete) {
          logActivity({ type: 'Transformation', description: `Étape '${etapeToDelete.nomProcessus}' supprimée.` }, currentUser);
        }
    }
  };

  const handleFormSubmit = async (data: Partial<EtapeTransformation & {quantiteAUtiliser: number}>) => {
    const { quantiteAUtiliser, id, ...payload } = data;
    const isNew = modalMode !== 'edit';
    
    const tempCostingData = {...payload, quantiteEntrante: quantiteAUtiliser || 0};
    const calculatedCosts = calculateEtapeTransformationCost(tempCostingData, allData);
    
    const finalData = { ...payload, quantiteEntrante: quantiteAUtiliser || 0, ...calculatedCosts };

    // Stock Adjustment Logic
    const oldEtapeData = isNew ? null : etapes.find(e => e.id === editingEtape!.id);
    const stockDeductingStatus = 'Terminée';
    
    const batch = writeBatch(db);
    let stockAdjustmentSuccessful = true;
    let errorMessage = '';

    // Phase 1: Re-credit old stock if applicable
    if (oldEtapeData && oldEtapeData.statut === stockDeductingStatus) {
        const qtyToRecredit = oldEtapeData.quantiteEntrante || 0;
        if(oldEtapeData.typeLotEntrant === 'Recolte') {
            const docRef = doc(db, 'recoltesData', oldEtapeData.lotEntrantId);
            const sourceRecolte = allData.recoltesData.find(r => r.id === oldEtapeData.lotEntrantId);
            if(sourceRecolte) batch.update(docRef, {poidsApresSechage: (sourceRecolte.poidsApresSechage || 0) + qtyToRecredit});
        } else {
            const sourceEtape = etapes.find(et => et.lotSortantId === oldEtapeData.lotEntrantId);
            if(sourceEtape) {
                const docRef = doc(db, 'etapesTransformationData', sourceEtape.id);
                batch.update(docRef, {quantiteSortante: (sourceEtape.quantiteSortante || 0) + qtyToRecredit});
            }
        }
    }

    // Phase 2: Deduct new stock if applicable
    if (finalData.statut === stockDeductingStatus) {
        const qtyToDeduct = quantiteAUtiliser || 0;
        if (qtyToDeduct <= 0) { stockAdjustmentSuccessful = false; errorMessage = "La quantité à utiliser doit être > 0."; }
        
        if (stockAdjustmentSuccessful) {
            if(finalData.typeLotEntrant === 'Recolte') {
                const sourceRecolte = allData.recoltesData.find(r => r.id === finalData.lotEntrantId);
                if (!sourceRecolte) { stockAdjustmentSuccessful = false; errorMessage = "Lot de récolte source introuvable."; }
                else {
                    let availableStock = sourceRecolte.poidsApresSechage || 0;
                    if(oldEtapeData?.lotEntrantId === sourceRecolte.id) availableStock += (oldEtapeData.quantiteEntrante || 0); // Consider re-credited amount
                    if (availableStock < qtyToDeduct) { stockAdjustmentSuccessful = false; errorMessage = "Stock de récolte insuffisant."; }
                    else {
                        const docRef = doc(db, 'recoltesData', sourceRecolte.id);
                        batch.update(docRef, {poidsApresSechage: availableStock - qtyToDeduct});
                    }
                }
            } else { // EtapeTransformationPrecedente
                const sourceEtape = etapes.find(et => et.lotSortantId === finalData.lotEntrantId);
                if (!sourceEtape) { stockAdjustmentSuccessful = false; errorMessage = "Étape précédente source introuvable."; }
                else {
                    let availableStock = sourceEtape.quantiteSortante || 0;
                    if(oldEtapeData?.lotEntrantId === sourceEtape.lotSortantId) availableStock += (oldEtapeData.quantiteEntrante || 0);
                    if (availableStock < qtyToDeduct) { stockAdjustmentSuccessful = false; errorMessage = "Stock de l'étape précédente insuffisant."; }
                    else {
                        const docRef = doc(db, 'etapesTransformationData', sourceEtape.id);
                        batch.update(docRef, {quantiteSortante: availableStock - qtyToDeduct});
                    }
                }
            }
        }
    }
    
    if (!stockAdjustmentSuccessful) {
        addToast(errorMessage, "error");
        return;
    }

    // Save the EtapeTransformation item itself
    if (isNew) {
        batch.set(doc(collection(db, "etapesTransformationData")), finalData);
    } else {
        batch.update(doc(db, "etapesTransformationData", editingEtape!.id), finalData);
    }
    
    await batch.commit();
    addToast(`Étape de transformation ${isNew ? 'créée' : 'modifiée'} avec succès.`, 'success');
    logActivity({ type: 'Transformation', description: `Étape de transformation '${finalData.nomProcessus}' ${isNew ? 'créée' : 'modifiée'}.` }, currentUser);
    setIsModalOpen(false);
    setEditingEtape(undefined);
  };

  const getActiveFormConfig = () => {
    let config = [...currentFormConfig];
    if (modalMode === 'edit' && editingEtape && editingEtape.id) {
      config.unshift({ name: 'id', label: 'ID (Automatique)', type: 'text', disabled: true });
    }
    const quantiteEntranteField = config.find(f => f.name === 'quantiteEntrante');
    if (quantiteEntranteField) {
        quantiteEntranteField.label = 'Qté Dispo. Lot Entrant (auto)';
    }
    return config;
  }
  
  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner l\'Étape de Transformation';
    return editingEtape && modalMode === 'edit' ? 'Modifier l\'Étape de Transformation' : 'Ajouter une Étape de Transformation';
  }

  return (
    <TabContentWrapper title="Suivi des Étapes de Transformation" onAddItem={handleAddItem} addButtonLabel="Ajouter Étape">
      <DataTable
        data={etapes}
        columns={etapeTransformationColumns}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
        onClone={handleCloneItem}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEtape(undefined); }}
        title={getModalTitle()}
      >
        {isModalOpen && (
            <DataForm<EtapeTransformation>
              formConfig={getActiveFormConfig()}
              initialData={editingEtape}
              onSubmit={handleFormSubmit}
              onCancel={() => { setIsModalOpen(false); setEditingEtape(undefined); }}
              isEditMode={modalMode !== 'add'}
              allData={allData}
            />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default EtapesTransformationTab;