import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Recolte, ColumnDefinition, FormFieldConfig, Travailleur, IntrantAgricole, AllData, CoutIntrantUtilise, StockagePostSechage, Culture, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, calculateRecolteCost, manageRecolteStockOnSave, logActivity } from '../../utils/helpers';
import { useToast } from '../ToastProvider';

const RECOLTE_STOCK_DEDUCTING_STATUSES: Recolte['statut'][] = ['Récoltée', 'Séchage en cours', 'Séchée'];

interface RecoltesTabProps {
  currentUser: User;
}

const getRecolteFormConfig = (): FormFieldConfig<Recolte>[] => [
  {
    name: 'cultureId',
    label: 'Culture Associée',
    type: 'select',
    required: true,
    dynamicEntityType: 'cultures',
    labelFieldForDynamicOptions: (culture: Culture) => `${culture.nomPlante} (Parcelle: ${culture.parcelle}, Plantée: ${formatDateForInput(culture.datePlantation)})`,
    secondaryFilter: (culture: Culture) => culture.statut === 'En culture',
    placeholder: 'Sélectionner une culture en cours',
    autoFillFields: [
        { sourceField: 'nomPlante', targetFormField: 'nomPlanteReadOnly' },
        { sourceField: 'parcelle', targetFormField: 'parcelleReadOnly' },
    ]
  },
  { name: 'nomPlanteReadOnly', label: 'Nom de la Plante (auto)', type: 'text', disabled: true },
  { name: 'parcelleReadOnly', label: 'Parcelle (auto)', type: 'text', disabled: true },
  { name: 'lotNumero', label: 'Numéro de Lot de la Récolte', type: 'text', required: true, placeholder: 'Format suggéré: LAV-24-001' },
  { name: 'dateRecolte', label: 'Date de la Récolte', type: 'date', required: true },
  {
    name: 'unitePoids',
    label: 'Unité de Poids Commune',
    type: 'select', 
    dynamicEntityType: 'parametresUniteMesure',
    placeholder: 'Sélectionner l\'unité (ex: g, kg)',
    required: true,
  },
  { name: 'quantiteRecolteeBrute', label: 'Qté Récoltée Brute', type: 'number', step: "0.01" },
  { name: 'poidsApresSechage', label: 'Poids Après Séchage', type: 'number', step: "0.01" },
  { 
    name: 'pertesRecolteSechage' as any,
    label: 'Perte de Poids (Calculée)',
    type: 'readonly_calculated',
    calculationFn: (formData) => {
        const perte = (formData.quantiteRecolteeBrute || 0) - (formData.poidsApresSechage || 0);
        return perte > 0 ? perte.toFixed(2) + ` ${formData.unitePoids || ''}` : '0';
    },
    dependsOn: ['quantiteRecolteeBrute', 'poidsApresSechage', 'unitePoids']
  },
  {
    name: 'tauxHumiditeCalcule' as any,
    label: 'Taux d\'Humidité / Perte (Calculé)',
    type: 'readonly_calculated',
    calculationFn: (formData) => {
        const brute = formData.quantiteRecolteeBrute || 0;
        const sec = formData.poidsApresSechage || 0;
        if (brute > 0 && sec > 0) {
            return (((brute - sec) / brute) * 100).toFixed(1) + ' %';
        }
        return 'N/A';
    },
    dependsOn: ['quantiteRecolteeBrute', 'poidsApresSechage']
  },
  { name: 'methodeRecolte', label: 'Méthode de Récolte', type: 'text', placeholder: 'Ex: Manuelle, Faucille' },
  { name: 'methodeSechage', label: 'Méthode de Séchage', type: 'text', placeholder: 'Ex: Sur claies, en bouquets suspendus' },
  { name: 'lieuStockageTemporaire', label: 'Lieu Stockage Temp. (pré-séchage)', type: 'text', placeholder: 'Ex: Hangar, chambre froide' },
  {
    name: 'travailleurs' as any,
    label: 'Travailleurs Impliqués (pour la récolte)',
    type: 'nested_list_stub',
    placeholder: 'Ajouter les heures par travailleur et par activité',
    subFormConfig: [
      {
        name: 'travailleurId', label: 'Travailleur', type: 'select', dynamicEntityType: 'travailleurs',
        labelFieldForDynamicOptions: 'nom', required: true, autoFillFields: [{sourceField: 'nom', targetFormField: 'nomTravailleur'}]
      },
      { name: 'nomTravailleur', label: 'Nom (auto)', type: 'text', disabled: true },
      { 
          name: 'activite', label: 'Activité de Récolte', type: 'select', required: true,
          options: [
              {value: 'Récolte', label: 'Récolte'},
              {value: 'Transport', label: 'Transport'},
              {value: 'Préparation au séchage', label: 'Préparation au séchage'},
              {value: 'Autre (Récolte)', label: 'Autre (Récolte)'},
          ]
      },
      { name: 'dateActivite', label: 'Date Activité', type: 'date', required: true },
      { name: 'heures', label: 'Heures Travaillées', type: 'number', step: "0.1", required: true },
    ],
    defaultItem: { _tempId: '', travailleurId: '', nomTravailleur: '', activite: 'Récolte', heures: 0, dateActivite: formatDateForInput(new Date().toISOString()) }
  },
  {
    name: 'intrantsUtilises' as any,
    label: 'Intrants Agricoles Utilisés (pour cette récolte)',
    type: 'nested_list_stub',
    placeholder: 'Lister les intrants spécifiques à cette récolte (ex: traitement post-récolte)',
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
    name: 'statut',
    label: 'Statut de la Récolte',
    type: 'select',
    required: true,
    options: [
      { value: 'Récoltée', label: 'Récoltée (Prête pour séchage, déduit stock intrants)' },
      { value: 'Séchage en cours', label: 'Séchage en cours (déduit stock intrants)' },
      { value: 'Séchée', label: 'Séchée (Disponible comme matière première)' },
      { value: 'Échouée', label: 'Échouée (Annulée, stock intrants recrédité)' },
    ],
    placeholder: 'Sélectionner statut'
  },
  {
      name: 'stockagePostSechage' as any,
      label: 'Stockage Post-Séchage (Traçabilité)',
      type: 'nested_list_stub',
      placeholder: 'Ajouter les contenants pour la matière sèche',
      subFormConfig: [
          { name: 'description', label: 'Description Contenant', type: 'text', required: true, placeholder: 'Ex: Seau alimentaire 20L' },
          { name: 'quantiteStockee', label: 'Quantité Stockée', type: 'number', required: true, step: '0.01' },
          { name: 'referenceStockage', label: 'Référence Contenant (Auto-suggérée)', type: 'text', placeholder: 'Ex: LAV24-001-S1' },
      ],
      defaultItem: (formData: Partial<Recolte>) => {
        const lotNumero = formData.lotNumero || '';
        const existingItemsCount = formData.stockagePostSechage?.length || 0;
        const newSuffix = `S${existingItemsCount + 1}`;
        return {
          _tempId: 'stk-' + Math.random(),
          description: '',
          quantiteStockee: 0,
          referenceStockage: lotNumero ? `${lotNumero}-${newSuffix}` : '',
        };
      },
  },
  { name: 'notes', label: 'Notes Générales', type: 'textarea' },
];

const RecoltesTab: React.FC<RecoltesTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { recoltesData: recoltes } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecolte, setEditingRecolte] = useState<Recolte | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();

  const recolteColumns: ColumnDefinition<Recolte>[] = [
    { 
        accessor: (item: Recolte, data?: AllData) => {
            const culture = (data || allData).culturesData.find(c => c.id === item.cultureId);
            return culture?.nomPlante || 'N/A';
        },
        Header: 'Plante',
        getSearchValue: (item, data) => (data || allData).culturesData.find(c => c.id === item.cultureId)?.nomPlante || ''
    },
    { accessor: 'lotNumero', Header: 'N° Lot', getSearchValue: item => item.lotNumero },
    { accessor: 'dateRecolte', Header: 'Date Récolte', cell: (item) => formatDateForInput(item.dateRecolte), getSearchValue: item => item.dateRecolte },
    { accessor: 'poidsApresSechage', Header: 'Poids Sec', cell: item => `${item.poidsApresSechage || ''} ${item.unitePoids || ''}`, getSearchValue: item => String(item.poidsApresSechage || '') },
    {
      accessor: (item, currentAllData) => {
        const costData = calculateRecolteCost(item, currentAllData || allData);
        return costData.coutUnitaireApresSechageEstime > 0 
            ? costData.coutUnitaireApresSechageEstime.toFixed(3) + ` CAD/${item.unitePoids || 'unité'}` 
            : 'N/A';
      },
      Header: 'Coût Unit. Sec Est.',
      getSearchValue: (item, currentAllData) => String(calculateRecolteCost(item, currentAllData || allData).coutUnitaireApresSechageEstime)
    },
    { accessor: 'statut', Header: 'Statut', getSearchValue: item => item.statut },
  ];

  const currentFormConfig = useMemo(() => getRecolteFormConfig(), []);

  const handleAddItem = useCallback(() => {
    setEditingRecolte({
        id: '', cultureId: '', lotNumero: '',
        dateRecolte: formatDateForInput(new Date().toISOString()),
        travailleurs: [], intrantsUtilises: [], statut: 'Récoltée',
        unitePoids: 'g', stockagePostSechage: [],
    } as Recolte);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: Recolte) => {
    const culture = allData.culturesData.find(c => c.id === item.cultureId);
    const itemToEdit = {
      ...item,
      dateRecolte: formatDateForInput(item.dateRecolte),
      nomPlanteReadOnly: culture?.nomPlante,
      parcelleReadOnly: culture?.parcelle,
      travailleurs: item.travailleurs?.map(t => ({...t, _tempId: 'temp-'+Math.random(), dateActivite: formatDateForInput(t.dateActivite) })) || [],
      intrantsUtilises: item.intrantsUtilises?.map(i => ({...i, _tempId: 'temp-'+Math.random(), dateUtilisation: formatDateForInput(i.dateUtilisation) })) || [],
      stockagePostSechage: item.stockagePostSechage?.map(s => ({...s, _tempId: 'temp-'+Math.random()})) || [],
    };
    setEditingRecolte(itemToEdit as any); // Cast because of readonly fields
    setModalMode('edit');
    setIsModalOpen(true);
  }, [allData.culturesData]);
  
  const handleCloneItem = useCallback((item: Recolte) => {
    const clonedItem = {
      ...item, id: '', lotNumero: '', dateRecolte: formatDateForInput(new Date().toISOString()),
      quantiteRecolteeBrute: undefined, poidsApresSechage: undefined, statut: 'Récoltée' as Recolte['statut'],
      coutProductionTotalEstime: undefined, coutUnitaireApresSechageEstime: undefined,
      travailleurs: item.travailleurs?.map(t => ({ ...t, _tempId: 'temp-'+Math.random() })) || [],
      intrantsUtilises: item.intrantsUtilises?.map(i => ({ ...i, _tempId: 'temp-'+Math.random() })) || [],
      stockagePostSechage: [],
    };
    setEditingRecolte(clonedItem as Recolte);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const recolteToDelete = recoltes.find(r => r.id === id);
    if (!recolteToDelete) return;

    try {
        const batch = writeBatch(db);
        
        // Re-credit intrant stock if applicable
        if (RECOLTE_STOCK_DEDUCTING_STATUSES.includes(recolteToDelete.statut) && recolteToDelete.intrantsUtilises) {
            for (const intrantUsed of recolteToDelete.intrantsUtilises) {
                const intrantLot = allData.intrantsAgricolesData.find(i => i.id === intrantUsed.intrantId);
                if (intrantLot) {
                    const docRef = doc(db, "intrantsAgricolesData", intrantLot.id);
                    const newStock = (intrantLot.quantiteRestante || 0) + intrantUsed.quantiteUtilisee;
                    batch.update(docRef, { quantiteRestante: newStock });
                }
            }
        }
        
        // Delete the harvest record
        batch.delete(doc(db, "recoltesData", id));

        await batch.commit();

        addToast('Récolte supprimée et stock ajusté.', 'success');
        const culture = allData.culturesData.find(c => c.id === recolteToDelete.cultureId);
        logActivity({
            type: 'Récolte',
            description: `Récolte du lot ${recolteToDelete.lotNumero} (${culture?.nomPlante || 'N/A'}) supprimée.`,
            tabKey: 'recoltes',
            itemId: recolteToDelete.id,
        }, currentUser);
    } catch (error: any) {
        console.error("Error deleting harvest:", { message: error.message, code: error.code });
        addToast('Erreur lors de la suppression.', 'error');
    }
  };

  const handleFormSubmit = async (dataFromForm: Partial<Recolte>) => {
    const { nomPlanteReadOnly, parcelleReadOnly, ...recolteData } = dataFromForm as any;
    
    const { coutProductionTotalEstime, coutUnitaireApresSechageEstime } = calculateRecolteCost(recolteData, allData);
    const isNew = modalMode !== 'edit';
    const oldRecolteData = isNew ? null : recoltes.find(r => r.id === editingRecolte!.id);

    const finalData: Omit<Recolte, 'id'> = {
        ...(recolteData as Omit<Recolte, 'id'>),
        travailleurs: recolteData.travailleurs?.map((t:any) => { const {_tempId, ...rest} = t; return rest; }) || [],
        intrantsUtilises: recolteData.intrantsUtilises?.map((i:any) => { const {_tempId, ...rest} = i; return rest; }) || [],
        stockagePostSechage: recolteData.stockagePostSechage?.map((s:any) => { const {_tempId, ...rest} = s; return rest; }) || [],
        coutProductionTotalEstime, coutUnitaireApresSechageEstime,
    };

    const stockResult = manageRecolteStockOnSave(oldRecolteData, finalData as Recolte, allData);

    if (!stockResult.success) {
        addToast(`Échec: ${stockResult.errorMessage}. Modifications non sauvegardées.`, 'error');
        return;
    }
    
    try {
        const batch = writeBatch(db);

        if (stockResult.updatedData?.intrantsAgricolesData) {
            stockResult.updatedData.intrantsAgricolesData.forEach(intrant => {
                const docRef = doc(db, "intrantsAgricolesData", intrant.id);
                batch.update(docRef, { quantiteRestante: intrant.quantiteRestante });
            });
        }
        
        let newId = editingRecolte?.id;
        if (isNew) {
            const newDocRef = doc(collection(db, "recoltesData"));
            batch.set(newDocRef, finalData);
            newId = newDocRef.id;
        } else {
            if (!editingRecolte?.id) throw new Error("ID manquant pour la modification.");
            batch.update(doc(db, "recoltesData", editingRecolte.id), finalData);
        }

        await batch.commit();

        logActivity({ type: 'Récolte', description: `Récolte du lot ${finalData.lotNumero} ${isNew ? 'enregistrée' : 'modifiée'}.`, tabKey: 'recoltes', itemId: newId }, currentUser);
        addToast(`Récolte ${isNew ? 'ajoutée' : 'modifiée'}.`, 'success');
        
        setIsModalOpen(false);
        setEditingRecolte(undefined);
    } catch(error: any) {
        console.error("Error saving harvest:", { message: (error as any).message, code: (error as any).code });
        addToast("Erreur lors de la sauvegarde.", 'error');
    }
  };

  const getActiveFormConfig = () => {
    let config = [...currentFormConfig];
    if (modalMode === 'edit' && editingRecolte && editingRecolte.id) {
      config.unshift({ name: 'id', label: 'ID (Automatique)', type: 'text', disabled: true });
    }
    return config;
  }

  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner la Récolte';
    return editingRecolte && modalMode === 'edit' ? 'Modifier la Récolte' : 'Ajouter une Récolte';
  }

  return (
    <TabContentWrapper title="Gestion des Récoltes" onAddItem={handleAddItem} addButtonLabel="Ajouter Récolte">
      <DataTable 
        data={recoltes} 
        columns={recolteColumns}
        onEdit={handleEditItem} 
        onDelete={handleDeleteItem}
        onClone={handleCloneItem}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingRecolte(undefined); }}
        title={getModalTitle()}
      >
        {isModalOpen && (
            <DataForm<Recolte>
              formConfig={getActiveFormConfig()}
              initialData={editingRecolte}
              onSubmit={handleFormSubmit}
              onCancel={() => { setIsModalOpen(false); setEditingRecolte(undefined); }}
              isEditMode={modalMode !== 'add'}
              allData={allData}
            />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default RecoltesTab;