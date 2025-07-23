

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Recette, ColumnDefinition, FormFieldConfig, IngredientAchete, Recolte, AllData, Travailleur, EtapeTransformation, ParametreItem, Culture, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { calculateRecolteCost, logActivity } from '../../utils/helpers';
import { useToast } from '../ToastProvider';

interface RecettesTabProps {
  currentUser: User;
}

const getRecetteFormConfig = (allData: AllData): FormFieldConfig<Recette>[] => [
  {
    name: 'produitFiniBaseId',
    label: 'Produit du Catalogue (Référence)',
    type: 'select',
    dynamicEntityType: 'produitsFiniBase',
    labelFieldForDynamicOptions: 'nom',
    placeholder: 'Lier à un produit du catalogue (Paramètres)',
    autoFillFields: [
        { sourceField: 'nom', targetFormField: 'nomProduitFini' },
        { sourceField: 'categorie', targetFormField: 'categorie' },
        { sourceField: 'uniteVente', targetFormField: 'uniteProductionReference' },
    ]
  },
  { name: 'nomProduitFini', label: 'Nom de la Recette / du Produit Fini', type: 'text', required: true, placeholder: 'Ex: Tisane "Relaxante", Baume Calendula' },
  { name: 'description', label: 'Description de la recette', type: 'textarea' },
  { name: 'categorie', label: 'Catégorie (auto-remplie depuis catalogue)', type: 'text', placeholder: 'Ex: Tisane, Baume, Cosmétique' },
  {
    name: 'composants' as any,
    label: 'Composants de la Recette (Références)',
    type: 'nested_list_stub',
    placeholder: 'Ajouter les ingrédients/plantes de référence et leurs quantités.',
    subFormConfig: [
      {
        name: 'typeComposant',
        label: 'Type Composant',
        type: 'select',
        options: [
            {value: 'IngredientGenerique', label: 'Ingrédient Acheté (Référence)'},
            {value: 'PlanteCultureBase', label: 'Plante Cultivée (Base)'}
        ],
        required: true,
      },
      {
        name: 'componentGenericId',
        label: 'Nom du Composant de Référence',
        type: 'select',
        dynamicEntityType: 'ingredientsAchetesNomsUniques',
        placeholder: 'Sélectionner Ingrédient/Plante de base',
        required: true,
        filterContextField: 'typeComposant',
        autoFillFields: [
            {
                sourceField: (entity: any) => entity.nom,
                targetFormField: 'nomPourAffichage'
            },
            {
                sourceField: (entity: ParametreItem) => entity.unite || '',
                targetFormField: 'unite'
            },
        ]
      },
      { name: 'nomPourAffichage', label: 'Nom Affiché (auto)', type: 'text', disabled: true },
      { name: 'quantite', label: 'Quantité Requise', type: 'number', required: true, step: "0.01" },
      { name: 'unite', label: 'Unité (auto/manuel)', type: 'text', required: true, placeholder: 'Ex: g, ml, parts' },
      { name: 'notes', label: 'Note sur le composant', type: 'text' },
    ],
    defaultItem: { _tempId: '', typeComposant: 'IngredientGenerique', componentGenericId: '', nomPourAffichage: '', quantite: 0, unite: 'g', notes: '' }
  },
  { name: 'instructions', label: 'Instructions de Préparation', type: 'textarea', placeholder: 'Décrire les étapes de la recette.' },
  { name: 'tempsPreparationEstime', label: 'Temps de Préparation Estimé (Référence)', type: 'text', placeholder: 'Ex: 2 heures, 30 min' },
  { name: 'quantiteProduiteParLotReference', label: 'Qté Produite / Lot de Référence', type: 'number', placeholder: 'Ex: 5 (pour 5 pots)' },
  { name: 'uniteProductionReference', label: 'Unité de Production (auto-remplie depuis catalogue)', type: 'text', placeholder: 'Ex: pots de 50ml, sachets de 100g' },
  {
    name: 'coutMatierePremiereEstimeParLotReference',
    label: 'Coût Matières Premières Estimé / Lot (Calculé)',
    type: 'readonly_calculated',
    calculationFn: (formData, dataContext) => {
        const currentAllData = dataContext || allData;
        if (!formData.composants || formData.composants.length === 0) return '0.00';
        let totalCost = 0;
        formData.composants.forEach(comp => {
            if (!comp.nomPourAffichage || !comp.quantite) return;
            if (comp.typeComposant === 'IngredientGenerique') {
                const ingredientsDuNom = currentAllData.ingredientsAchetesData.filter(i => i.nom === comp.nomPourAffichage && typeof i.coutUnitaire === 'number');
                const coutMoyen = ingredientsDuNom.length > 0
                                ? ingredientsDuNom.reduce((acc, curr) => acc + (curr.coutUnitaire || 0), 0) / ingredientsDuNom.length
                                : 0;
                if (coutMoyen) totalCost += comp.quantite * coutMoyen;
            } else if (comp.typeComposant === 'PlanteCultureBase') {
                let costFound = false;
                const culturesCorrespondantes = currentAllData.culturesData.filter(c => c.nomPlante === comp.nomPourAffichage);
                const cultureIds = culturesCorrespondantes.map(c => c.id);

                const recoltesCorrespondantes = currentAllData.recoltesData.filter(
                    r => cultureIds.includes(r.cultureId) && typeof r.coutUnitaireApresSechageEstime === 'number' && r.coutUnitaireApresSechageEstime > 0
                );

                if (recoltesCorrespondantes.length > 0) {
                    const coutMoyenRecolte = recoltesCorrespondantes.reduce((sum, r) => sum + r.coutUnitaireApresSechageEstime!, 0) / recoltesCorrespondantes.length;
                    totalCost += comp.quantite * coutMoyenRecolte;
                    costFound = true;
                }

                if (!costFound) {
                    const etapesCorrespondantes = currentAllData.etapesTransformationData.filter(
                        et => et.matiereEntranteDescription.toLowerCase().includes(comp.nomPourAffichage.toLowerCase()) && typeof et.coutUnitaireSortantEstime === 'number' && et.coutUnitaireSortantEstime > 0
                    );
                    if (etapesCorrespondantes.length > 0) {
                        const coutMoyenEtape = etapesCorrespondantes.reduce((sum, et) => sum + et.coutUnitaireSortantEstime!, 0) / etapesCorrespondantes.length;
                        totalCost += comp.quantite * coutMoyenEtape;
                    }
                }
            }
        });
        return totalCost > 0 ? totalCost.toFixed(2) : '0.00';
    },
    dependsOn: ['composants']
  },
  { name: 'notes', label: 'Notes Générales sur la Recette', type: 'textarea' },
];

const RecettesTab: React.FC<RecettesTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { recettesData: recettes } = allData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecette, setEditingRecette] = useState<Recette | undefined>(undefined);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');
  const { addToast } = useToast();

  const recetteColumns: ColumnDefinition<Recette>[] = [
    { accessor: 'nomProduitFini', Header: 'Nom Produit/Recette', getSearchValue: item => item.nomProduitFini },
    { accessor: 'categorie', Header: 'Catégorie', getSearchValue: item => item.categorie || '' },
    {
      accessor: 'composants',
      Header: 'Nb. Composants',
      cell: (item) => item.composants?.length || 0
    },
    {
        accessor: (item, currentAllData?: AllData) => {
            const data = currentAllData || allData;
            // This calculation should mirror the one in formConfig
            if (!item.composants || item.composants.length === 0) return '0.00 CAD';
            let totalCost = 0;
            item.composants.forEach(comp => {
                if (!comp.nomPourAffichage || !comp.quantite) return;
                if (comp.typeComposant === 'IngredientGenerique') {
                    const ingredientsDuNom = data.ingredientsAchetesData.filter(i => i.nom === comp.nomPourAffichage && typeof i.coutUnitaire === 'number');
                    const coutMoyen = ingredientsDuNom.length > 0
                                    ? ingredientsDuNom.reduce((acc, curr) => acc + (curr.coutUnitaire || 0), 0) / ingredientsDuNom.length
                                    : 0;
                    if (coutMoyen) totalCost += comp.quantite * coutMoyen;
                } else if (comp.typeComposant === 'PlanteCultureBase') {
                    let costFound = false;
                    const culturesCorrespondantes = data.culturesData.filter(c => c.nomPlante === comp.nomPourAffichage);
                    const cultureIds = culturesCorrespondantes.map(c => c.id);

                    const recoltesCorrespondantes = data.recoltesData.filter(
                        r => cultureIds.includes(r.cultureId) && typeof r.coutUnitaireApresSechageEstime === 'number' && r.coutUnitaireApresSechageEstime > 0
                    );
                    if (recoltesCorrespondantes.length > 0) {
                        const coutMoyenRecolte = recoltesCorrespondantes.reduce((sum, r) => sum + r.coutUnitaireApresSechageEstime!, 0) / recoltesCorrespondantes.length;
                        totalCost += comp.quantite * coutMoyenRecolte;
                        costFound = true;
                    }
                    if (!costFound) {
                        const etapesCorrespondantes = data.etapesTransformationData.filter(
                            et => et.matiereEntranteDescription.toLowerCase().includes(comp.nomPourAffichage.toLowerCase()) && typeof et.coutUnitaireSortantEstime === 'number' && et.coutUnitaireSortantEstime > 0
                        );
                        if (etapesCorrespondantes.length > 0) {
                            const coutMoyenEtape = etapesCorrespondantes.reduce((sum, et) => sum + et.coutUnitaireSortantEstime!, 0) / etapesCorrespondantes.length;
                            totalCost += comp.quantite * coutMoyenEtape;
                        }
                    }
                }
            });
            return totalCost > 0 ? totalCost.toFixed(2) + " CAD" : '0.00 CAD';
        },
        Header: 'Coût Matières Est. / Lot Réf.',
        getSearchValue: (item, currentAllData) => {
             const costFn = recetteColumns.find(c => c.Header === 'Coût Matières Est. / Lot Réf.')?.accessor;
             if(typeof costFn === 'function') {
                const costResult = costFn(item, currentAllData);
                return typeof costResult === 'string' ? costResult : String(costResult);
             }
             return '';
        }
    },
    { accessor: 'tempsPreparationEstime', Header: 'Temps Prépa.', getSearchValue: item => item.tempsPreparationEstime || '' },
  ];


  const currentFormConfig = useMemo(() => getRecetteFormConfig(allData), [allData]);

  const handleAddItem = useCallback(() => {
    setEditingRecette({
        id: '',
        produitFiniBaseId: undefined, 
        nomProduitFini: '',
        composants: [],
        categorie: '',
        uniteProductionReference: '',
    } as Recette); 
    setModalMode('add');
    setIsModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: Recette) => {
    const itemToEdit = { ...item, composants: item.composants?.map(c => ({...c, _tempId: c._tempId || 'temp-' + Math.random()})) || [] };
    setEditingRecette(itemToEdit);
    setModalMode('edit');
    setIsModalOpen(true);
  }, []);
  
  const handleCloneItem = useCallback((item: Recette) => {
    const clonedItem = {
      ...item,
      id: '',
      nomProduitFini: `${item.nomProduitFini} (Copie)`,
      composants: item.composants?.map(c => ({ ...c, _tempId: 'temp-' + Math.random() })) || [],
    };
    setEditingRecette(clonedItem);
    setModalMode('clone');
    setIsModalOpen(true);
  }, []);


  const handleDeleteItem = async (id: string) => {
    const itemToDelete = recettes.find(r => r.id === id);
    try {
      await deleteDoc(doc(db, "recettesData", id));
      addToast('Recette supprimée.', 'success');
      if (itemToDelete) {
        logActivity({ type: 'Recette', description: `Recette '${itemToDelete.nomProduitFini}' supprimée.` }, currentUser);
      }
    } catch (error: any) {
      console.error("Error deleting recipe:", { code: error.code, message: error.message });
      addToast("Erreur lors de la suppression.", 'error');
    }
  };

  const handleFormSubmit = async (data: Partial<Recette>) => {
    const { id, ...payload } = data;
    const isNew = modalMode !== 'edit';

    const calculatedCost = getRecetteFormConfig(allData).find(f => f.name === 'coutMatierePremiereEstimeParLotReference')?.calculationFn?.(data, allData);
    
    payload.coutMatierePremiereEstimeParLotReference = typeof calculatedCost === 'string' ? parseFloat(calculatedCost) : (calculatedCost || 0);
    payload.composants = payload.composants?.map(c => { const {_tempId, ...rest} = c; return rest; }) || [];
    
    try {
      if (isNew) {
        await addDoc(collection(db, "recettesData"), payload);
        addToast('Recette ajoutée.', 'success');
        logActivity({ type: 'Recette', description: `Nouvelle recette '${data.nomProduitFini}' ajoutée.` }, currentUser);
      } else {
        if (!editingRecette?.id) throw new Error("ID manquant pour la modification.");
        await updateDoc(doc(db, "recettesData", editingRecette.id), payload);
        addToast('Recette modifiée.', 'success');
        logActivity({ type: 'Recette', description: `Recette '${data.nomProduitFini}' modifiée.` }, currentUser);
      }
      setIsModalOpen(false);
      setEditingRecette(undefined);
    } catch(error: any) {
        console.error("Error saving recipe:", { code: error.code, message: error.message });
        addToast("Erreur lors de la sauvegarde.", 'error');
    }
  };

  const getActiveFormConfig = () => {
    let config = [...currentFormConfig];
    if (modalMode !== 'add' && editingRecette) {
      config.unshift({ name: 'id', label: 'ID (Automatique)', type: 'text', disabled: true });
    }
    return config;
  }
  
  const getModalTitle = () => {
    if (modalMode === 'clone') return 'Cloner la Recette';
    return editingRecette && modalMode === 'edit' ? 'Modifier la Recette' : 'Ajouter une Recette';
  }

  return (
    <TabContentWrapper title="Gestion des Recettes" onAddItem={handleAddItem} addButtonLabel="Ajouter Recette">
      <DataTable
        data={recettes}
        columns={recetteColumns}
        onEdit={handleEditItem}
        onDelete={handleDeleteItem}
        onClone={handleCloneItem}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingRecette(undefined); }}
        title={getModalTitle()}
      >
        {isModalOpen && (
            <DataForm<Recette>
              formConfig={getActiveFormConfig()}
              initialData={editingRecette}
              onSubmit={handleFormSubmit}
              onCancel={() => { setIsModalOpen(false); setEditingRecette(undefined); }}
              isEditMode={modalMode !== 'add'}
              allData={allData}
            />
        )}
      </Modal>
    </TabContentWrapper>
  );
};

export default RecettesTab;