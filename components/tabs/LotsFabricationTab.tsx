

import React, { useState, useCallback, useMemo, useEffect, useContext } from 'react';
import {
    LotFabrication, ColumnDefinition, FormFieldConfig, Recette, Conditionnement, ConditionnementUtilise,
    Travailleur, IngredientAchete, Recolte, AllData, EtapeTransformation, ComposantRecette, ComposantLotFabrication, Culture, User
} from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, calculateLotFabricationCost, manageLotFabricationStockOnSave, manageLotFabricationStockOnDelete, logActivity } from '../../utils/helpers';
import { useToast } from '../ToastProvider';

interface LotsFabricationTabProps {
    currentUser: User;
}

const getLotFabricationFormConfig = (allData: AllData): FormFieldConfig<LotFabrication>[] => [
  {
    name: 'recetteId',
    label: 'Recette Utilisée',
    type: 'select',
    required: true,
    dynamicEntityType: 'recettes',
    labelFieldForDynamicOptions: (rec: Recette, currentAllData?: AllData) => {
        const pfb = (currentAllData || allData).produitsFiniBaseData.find(p => p.id === rec.produitFiniBaseId);
        return pfb?.nom || rec.nomProduitFini || `Recette ID: ${rec.id.substring(0,6)}`;
    },
    placeholder: 'Sélectionner la recette de base',
    autoFillFields: [
        {
            sourceField: (rec: Recette, currentAllData?: AllData) => {
                const pfb = (currentAllData || allData).produitsFiniBaseData.find(p => p.id === rec.produitFiniBaseId);
                return pfb?.nom || rec.nomProduitFini;
            },
            targetFormField: 'nomProduitFini'
        },
        {
            sourceField: (rec: Recette, currentAllData?: AllData) => {
                 const pfb = (currentAllData || allData).produitsFiniBaseData.find(p => p.id === rec.produitFiniBaseId);
                 return pfb?.uniteVente || rec.uniteProductionReference;
            },
            targetFormField: 'uniteFabriquee'
        },
        {
            sourceField: (rec: Recette, currentAllData?: AllData) => {
                 const pfb = (currentAllData || allData).produitsFiniBaseData.find(p => p.id === rec.produitFiniBaseId);
                 return pfb?.prixVenteUnitaire;
            },
            targetFormField: 'prixVenteUnitaireSuggere'
        },
        {
            sourceField: (recette: Recette, allData?: AllData) => {
                if (!recette || !allData) return '';
                const pfb = allData.produitsFiniBaseData.find(p => p.id === recette.produitFiniBaseId);
                const prefix = (pfb?.nom || recette.nomProduitFini || 'PROD').substring(0, 4).toUpperCase().replace(/\s/g, '');
                const year = new Date().getFullYear().toString().slice(-2);
                const lotsForThisRecipe = allData.lotsFabricationData.filter(l => l.recetteId === recette.id).length;
                const nextId = (lotsForThisRecipe + 1).toString().padStart(3, '0');
                return `${prefix}-${year}-${nextId}`;
            },
            targetFormField: 'lotNumeroProduitFini'
        }
    ]
  },
  { name: 'nomProduitFini', label: 'Nom du Produit Fini (auto)', type: 'text', required: true, disabled: true },
  { name: 'lotNumeroProduitFini', label: 'N° Lot Produit Fini (Auto-suggéré)', type: 'text', required: true, placeholder: 'Ex: BCM24-001' },
  { name: 'dateFabrication', label: 'Date de Fabrication', type: 'date', required: true },
  { name: 'quantiteFabriquee', label: 'Quantité Fabriquée (Nombre d\'unités P.F.)', type: 'number', required: true, placeholder: 'Ex: 100', step: "1" },
  { name: 'uniteFabriquee', label: 'Unité Fabriquée (auto)', type: 'text', required: true, disabled: true },
  {
    name: 'composantsUtilises' as any,
    label: 'Composants & Lots Spécifiques Utilisés',
    type: 'nested_list_stub',
    placeholder: 'Sélectionner les lots spécifiques pour chaque composant de la recette.',
    subFormConfig: [
      { name: 'nomComposant', label: 'Nom Composant (Recette)', type: 'text', required: true, disabled: true },
      {
        name: 'typeComposant',
        label: 'Type Composant (Recette)',
        type: 'select',
        options: [ {value: 'IngredientAchete', label: 'Ingrédient Acheté'}, {value: 'PlanteCultivee', label: 'Plante Cultivée (Récolte/Transfo.)'} ],
        required: true,
        disabled: true,
      },
      {
        name: 'lotUtiliseId',
        label: 'Lot Matière Première Spécifique Utilisé',
        type: 'select',
        dynamicEntityType: 'ingredientsAchetes', 
        valueFieldForDynamicOptions: 'id',
        labelFieldForDynamicOptions: (entity: any, currentAllData?: AllData) => {
            const localAllData = currentAllData || allData;
            if (entity && 'quantiteRestante' in entity && 'type' in entity && typeof entity.type === 'string') { // IngredientAchete
                const ing = entity as IngredientAchete;
                 return `${ing.nom} (Lot: ${ing.numeroLotFournisseur || ing.id.substring(0,4)}) - Stock Lot: ${ing.quantiteRestante.toFixed(2)}${ing.unite} - Péremption: ${ing.datePeremption ? formatDateForInput(ing.datePeremption) : 'N/A'}`;
            } else if (entity && 'lotNumero' in entity && 'cultureId' in entity) { // Recolte
                const rec = entity as Recolte;
                const culture = localAllData.culturesData.find(c => c.id === rec.cultureId);
                return `${culture?.nomPlante || 'N/A'} (Lot Récolte: ${rec.lotNumero}) - Stock Lot: ${(rec.poidsApresSechage || 0).toFixed(2)}${rec.unitePoids || ''}`;
            } else if (entity && 'lotSortantId' in entity && entity.matiereSortanteDescription) { // EtapeTransformation
                const et = entity as EtapeTransformation;
                return `${et.matiereSortanteDescription} (Lot Transfo: ${et.lotSortantId}) - Stock Lot: ${(et.quantiteSortante || 0).toFixed(2)}${et.uniteSortante || ''}`;
            }
            return entity.id ? (entity.nom || entity.id.substring(0,6)) : 'Sélectionner';
        },
        filterContextField: 'typeComposant', 
        secondaryFilter: (item: any, subFormData: ComposantLotFabrication): boolean => {
            if (subFormData.lotUtiliseId === item.id) return true; // Always show the selected item

            if ('quantiteRestante' in item) { // IngredientAchete
                return item.quantiteRestante > 0;
            }
            if ('poidsApresSechage' in item) { // Recolte
                return item.statut === 'Séchée' && item.poidsApresSechage > 0;
            }
            if ('quantiteSortante' in item) { // EtapeTransformation
                return item.statut === 'Terminée' && item.quantiteSortante > 0;
            }
            return false;
        },
        required: true,
        placeholder: 'Sélectionner le lot spécifique',
        autoFillFields: [
             {
                sourceField: (entity: any, localAllData) => {
                    if ('quantiteRestante' in entity) return `${(entity as IngredientAchete).nom} (Lot: ${(entity as IngredientAchete).numeroLotFournisseur || (entity as IngredientAchete).id.substring(0,4)})`;
                    if ('cultureId' in entity) {
                        const culture = localAllData?.culturesData.find(c => c.id === (entity as Recolte).cultureId);
                        return `${culture?.nomPlante || 'N/A'} (Lot: ${(entity as Recolte).lotNumero})`;
                    }
                    if ('matiereSortanteDescription' in entity) return `${(entity as EtapeTransformation).matiereSortanteDescription} (Lot: ${(entity as EtapeTransformation).lotSortantId})`;
                    return '';
                },
                targetFormField: 'descriptionLotUtilise'
            },
        ]
      },
      { name: 'descriptionLotUtilise', label: 'Description Lot (auto)', type: 'text', disabled: true },
      { name: 'quantitePrelevee', label: 'Qté Requise (Recette)', type: 'number', step: "0.001", required: true, disabled: true },
      { name: 'unitePrelevee', label: 'Unité (Recette)', type: 'text', required: true, disabled: true },
    ],
    defaultItem: { _tempId: '', nomComposant: '', typeComposant: 'IngredientAchete', lotUtiliseId: '', descriptionLotUtilise: '', quantitePrelevee: 0, unitePrelevee: '' }
  },
  {
    name: 'conditionnementsUtilises' as any,
    label: 'Conditionnements Utilisés',
    type: 'nested_list_stub',
    subFormConfig: [
      {
        name: 'conditionnementId',
        label: 'Conditionnement (Lot)',
        type: 'select',
        dynamicEntityType: 'conditionnements',
        labelFieldForDynamicOptions: (cond: Conditionnement) => `${cond.nom} (Réf: ${cond.referenceFournisseur || cond.id.substring(0,6)}) - Stock Lot: ${cond.quantiteRestante}`,
        secondaryFilter: (item: Conditionnement, subFormData: ConditionnementUtilise) => (item.id === subFormData.conditionnementId) || item.quantiteRestante > 0,
        required: true,
        autoFillFields: [{sourceField: 'nom', targetFormField: 'nomConditionnement'}]
      },
      { name: 'nomConditionnement', label: 'Nom (auto)', type: 'text', disabled: true},
      { name: 'quantite', label: 'Quantité Utilisée', type: 'number', required: true, step: "1" },
    ],
    defaultItem: { _tempId: '', conditionnementId: '', nomConditionnement: '', quantite: 0 }
  },
  {
    name: 'travailleurs' as any,
    label: 'Travailleurs Impliqués (Fabrication)',
    type: 'nested_list_stub',
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
  { name: 'dluo', label: 'DLUO', type: 'date' },
  {
    name: 'prixRevientUnitaireEstime',
    label: 'Prix Revient Unitaire Estimé (CAD)',
    type: 'readonly_calculated',
    calculationFn: (formData, currentAllData) => calculateLotFabricationCost(formData, currentAllData || allData).prixRevientUnitaireEstime.toFixed(3),
    dependsOn: ['recetteId', 'composantsUtilises', 'conditionnementsUtilises', 'travailleurs', 'quantiteFabriquee']
  },
  { name: 'prixVenteUnitaireSuggere', label: 'Prix Vente Unitaire Suggéré (CAD)', type: 'number', step: "0.01" },
  {
    name: 'statut',
    label: 'Statut Lot Fabrication',
    type: 'select',
    required: true,
    options: [
      { value: 'Planifiée', label: 'Planifiée' },
      { value: 'En cours', label: 'En cours' },
      { value: 'Fabriquée', label: 'Fabriquée (Stock déduit)' },
      { value: 'Contrôle Qualité', label: 'Contrôle Qualité (Stock déduit)' },
      { value: 'Commercialisable', label: 'Commercialisable (Stock déduit)' },
      { value: 'Écartée', label: 'Écartée (Stock ajusté si besoin)' },
    ],
    placeholder: 'Sélectionner statut'
  },
  { name: 'notesControleQualite', label: 'Notes Contrôle Qualité', type: 'textarea' },
  { name: 'notes', label: 'Notes Générales', type: 'textarea' },
];

const LotsFabricationTab: React.FC<LotsFabricationTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { lotsFabricationData: lots, recettesData } = allData;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<LotFabrication | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();

  const lotFabricationColumns: ColumnDefinition<LotFabrication>[] = [
    { accessor: 'nomProduitFini', Header: 'Produit Fini', getSearchValue: item => item.nomProduitFini },
    { accessor: 'lotNumeroProduitFini', Header: 'N° Lot PF', getSearchValue: item => item.lotNumeroProduitFini },
    { accessor: 'dateFabrication', Header: 'Date Fab.', cell: (item) => formatDateForInput(item.dateFabrication), getSearchValue: item => formatDateForInput(item.dateFabrication) },
    { accessor: 'quantiteFabriquee', Header: 'Qté Fab.', getSearchValue: item => String(item.quantiteFabriquee) },
    { accessor: (item) => (item.quantiteFabriquee || 0) - (item.quantiteVendue || 0), Header: 'Qté Restante', getSearchValue: (item) => String((item.quantiteFabriquee || 0) - (item.quantiteVendue || 0))},
    {
      accessor: (item) => item.prixRevientUnitaireEstime ? item.prixRevientUnitaireEstime.toFixed(2) + " CAD" : 'N/A',
      Header: 'Prix Revient Est.',
      getSearchValue: item => String(item.prixRevientUnitaireEstime || '')
    },
    { accessor: 'statut', Header: 'Statut', getSearchValue: item => item.statut },
  ];

  const currentFormConfig = useMemo(() => getLotFabricationFormConfig(allData), [allData]);

  useEffect(() => {
    if (editingLot && editingLot.recetteId) {
        const recette = recettesData.find(r => r.id === editingLot.recetteId);
        if (recette) {
            const shouldPrefillComposants = !editingLot.composantsUtilises || editingLot.composantsUtilises.length === 0 ||
                                            editingLot.composantsUtilises.length !== recette.composants.length ||
                                            !editingLot.composantsUtilises.every((usedComp, idx) => usedComp.nomComposant === recette.composants[idx]?.nomPourAffichage);

            if (shouldPrefillComposants) {
                const prefilledComposants: ComposantLotFabrication[] = recette.composants.map(rc_comp => {
                    const mappedType: 'IngredientAchete' | 'PlanteCultivee' = rc_comp.typeComposant === 'IngredientGenerique' ? 'IngredientAchete' : 'PlanteCultivee';
                    return {
                        _tempId: 'comp-' + Math.random(),
                        nomComposant: rc_comp.nomPourAffichage,
                        typeComposant: mappedType,
                        lotUtiliseId: '', 
                        descriptionLotUtilise: '',
                        quantitePrelevee: rc_comp.quantite,
                        unitePrelevee: rc_comp.unite,
                    };
                });
                 setEditingLot(prev => prev ? ({
                    ...prev,
                    composantsUtilises: prefilledComposants,
                 }) : undefined);
            }
        }
    }
  }, [editingLot?.recetteId, recettesData]);


  const handleAddItem = useCallback(() => {
    setEditingLot({
        id: '',
        recetteId: '',
        nomProduitFini: '',
        lotNumeroProduitFini: '',
        dateFabrication: formatDateForInput(new Date().toISOString()),
        quantiteFabriquee: 0,
        uniteFabriquee: '',
        quantiteVendue: 0,
        composantsUtilises: [],
        conditionnementsUtilises: [],
        travailleurs: [],
        statut: 'Planifiée',
    } as LotFabrication);
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: LotFabrication) => {
    const itemToEdit = {
      ...item,
      dateFabrication: formatDateForInput(item.dateFabrication),
      dluo: formatDateForInput(item.dluo),
      quantiteVendue: item.quantiteVendue || 0,
      composantsUtilises: item.composantsUtilises?.map(c => ({...c, _tempId: c._tempId || 'temp-'+Math.random()})) || [],
      conditionnementsUtilises: item.conditionnementsUtilises?.map(c => ({...c, _tempId: c._tempId || 'temp-'+Math.random()})) || [],
      travailleurs: item.travailleurs?.map(t => ({...t, _tempId: t._tempId || 'temp-'+Math.random()})) || [],
    };
    setEditingLot(itemToEdit);
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);

  const handleCloneItem = useCallback((item: LotFabrication) => {
    const today = new Date();
    const dateSuffix = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const newLotNumber = `${item.nomProduitFini.substring(0,4).toUpperCase()}-${dateSuffix}-`+ Math.random().toString(36).substr(2, 4).toUpperCase();
    const clonedItem = {
      ...item,
      id: '',
      lotNumeroProduitFini: newLotNumber,
      dateFabrication: formatDateForInput(today.toISOString()),
      dluo: undefined,
      statut: 'Planifiée' as LotFabrication['statut'],
      quantiteVendue: 0,
      prixRevientUnitaireEstime: undefined,
      notesControleQualite: undefined,
      composantsUtilises: item.composantsUtilises?.map(c => ({ ...c, _tempId: 'temp-'+Math.random(), lotUtiliseId: '', descriptionLotUtilise: '' })) || [],
      conditionnementsUtilises: item.conditionnementsUtilises?.map(c => ({ ...c, _tempId: 'temp-'+Math.random() })) || [],
      travailleurs: item.travailleurs?.map(t => ({ ...t, _tempId: 'temp-'+Math.random() })) || [],
    };
    setEditingLot(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const lotToDelete = lots.find(l => l.id === id);
    if (!lotToDelete) return;
    
    const stockResult = manageLotFabricationStockOnDelete(lotToDelete, allData);
    
    if (!stockResult.success) {
        addToast(stockResult.errorMessage || 'Erreur lors de la suppression.', 'error');
        return;
    }

    try {
        const batch = writeBatch(db);
        if (stockResult.updatedData?.conditionnementsData) {
            stockResult.updatedData.conditionnementsData.forEach(c => batch.update(doc(db, "conditionnementsData", c.id), {quantiteRestante: c.quantiteRestante}));
        }
        if (stockResult.updatedData?.ingredientsAchetesData) {
            stockResult.updatedData.ingredientsAchetesData.forEach(i => batch.update(doc(db, "ingredientsAchetesData", i.id), {quantiteRestante: i.quantiteRestante}));
        }
        if (stockResult.updatedData?.recoltesData) {
            stockResult.updatedData.recoltesData.forEach(r => batch.update(doc(db, "recoltesData", r.id), {poidsApresSechage: r.poidsApresSechage}));
        }
        if (stockResult.updatedData?.etapesTransformationData) {
            stockResult.updatedData.etapesTransformationData.forEach(e => batch.update(doc(db, "etapesTransformationData", e.id), {quantiteSortante: e.quantiteSortante}));
        }
        batch.delete(doc(db, "lotsFabricationData", id));
        await batch.commit();

        addToast("Lot de fabrication supprimé et stocks ajustés.", "success");
        logActivity({ type: 'Fabrication', description: `Lot ${lotToDelete.lotNumeroProduitFini} (${lotToDelete.nomProduitFini}) supprimé.`, tabKey: 'lotsFabrication', itemId: lotToDelete.id }, currentUser);
    } catch(error) {
        console.error("Error deleting lot:", error);
        addToast("Erreur lors de la suppression du lot.", "error");
    }
  };


  const handleFormSubmit = async (dataFromForm: Partial<LotFabrication>) => {
    const { id, ...payload } = dataFromForm;
    const isNew = modalMode !== 'edit';
    
    payload.prixRevientUnitaireEstime = calculateLotFabricationCost(payload, allData).prixRevientUnitaireEstime;
    payload.quantiteVendue = isNew ? 0 : (lots.find(l=>l.id===id)?.quantiteVendue || 0);
    payload.composantsUtilises = payload.composantsUtilises?.map(c => { const {_tempId, ...rest} = c; return rest; }) || [];
    payload.conditionnementsUtilises = payload.conditionnementsUtilises?.map(c => { const {_tempId, ...rest} = c; return rest; }) || [];
    payload.travailleurs = payload.travailleurs?.map(t => { const {_tempId, ...rest} = t; return rest; }) || [];
    
    const oldLotData = isNew ? null : lots.find(l => l.id === editingLot!.id);
    const stockResult = manageLotFabricationStockOnSave(oldLotData, payload as LotFabrication, allData);

    if (!stockResult.success) {
        addToast(`Échec: ${stockResult.errorMessage}.`, "error");
        return;
    }

    try {
        const batch = writeBatch(db);
        if (stockResult.updatedData?.conditionnementsData) {
            stockResult.updatedData.conditionnementsData.forEach(c => batch.update(doc(db, "conditionnementsData", c.id), {quantiteRestante: c.quantiteRestante}));
        }
        if (stockResult.updatedData?.ingredientsAchetesData) {
            stockResult.updatedData.ingredientsAchetesData.forEach(i => batch.update(doc(db, "ingredientsAchetesData", i.id), {quantiteRestante: i.quantiteRestante}));
        }
        if (stockResult.updatedData?.recoltesData) {
            stockResult.updatedData.recoltesData.forEach(r => batch.update(doc(db, "recoltesData", r.id), {poidsApresSechage: r.poidsApresSechage}));
        }
        if (stockResult.updatedData?.etapesTransformationData) {
            stockResult.updatedData.etapesTransformationData.forEach(e => batch.update(doc(db, "etapesTransformationData", e.id), {quantiteSortante: e.quantiteSortante}));
        }
        
        if (isNew) {
            const newDocRef = doc(collection(db, "lotsFabricationData"));
            batch.set(newDocRef, payload);
        } else {
            batch.update(doc(db, "lotsFabricationData", editingLot!.id), payload);
        }
        
        await batch.commit();

        addToast(`Lot de fabrication ${isNew ? 'ajouté' : 'modifié'} avec succès.`, "success");
        logActivity({ type: 'Fabrication', description: `Lot ${payload.lotNumeroProduitFini} (${payload.nomProduitFini}) ${isNew ? 'créé' : 'modifié'}.` }, currentUser);
        setIsModalOpen(false);
        setEditingLot(undefined);
    } catch(error) {
        console.error("Error saving lot:", error);
        addToast("Erreur lors de la sauvegarde du lot.", "error");
    }
  };


  const getActiveFormConfig = () => {
    let config = [...currentFormConfig];
    if (modalMode === 'edit' && editingLot && editingLot.id) {
      config.unshift({ name: 'id', label: 'ID (Automatique)', type: 'text', disabled: true });
    }
    return config;
  }

  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner le Lot de Fabrication';
    return editingLot && modalMode === 'edit' ? 'Modifier le Lot de Fabrication' : 'Ajouter un Lot de Fabrication';
  }

  return (
    <TabContentWrapper title="Suivi des Lots de Fabrication" onAddItem={handleAddItem} addButtonLabel="Ajouter Lot Fabrication">
      <DataTable
        data={lots}
        columns={lotFabricationColumns.map(col => ({
            ...col,
            ...(typeof col.accessor === 'function' && { accessor: (item: LotFabrication) => (col.accessor as Function)(item, allData) }),
            ...(col.cell && { cell: (item: LotFabrication) => (col.cell as Function)(item, allData) })
        }))}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
        onClone={handleCloneItem}
        />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLot(undefined);}}
        title={getModalTitle()}
      >
        {isModalOpen && (
            <DataForm<LotFabrication>
              formConfig={getActiveFormConfig()}
              initialData={editingLot}
              onSubmit={handleFormSubmit}
              onCancel={() => { setIsModalOpen(false); setEditingLot(undefined);}}
              isEditMode={modalMode !== 'add'}
              allData={allData}
            />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default LotsFabricationTab;