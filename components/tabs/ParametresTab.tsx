

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { ParametreItem, ProduitFiniBase, SeuilIngredientGenerique, ColumnDefinition, FormFieldConfig, SeuilConditionnement, SeuilIntrantAgricole, KPIKey, User, CompanyInfo } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import { generateId, logActivity } from '../../utils/helpers';
import { useToast } from '../ToastProvider';
import { KPI_CONFIGS } from '../../constants';

interface ParametresTabProps {
  currentUser: User;
}

const baseParametreItemFormConfig: FormFieldConfig<ParametreItem>[] = [
  { name: 'nom', label: 'Nom', type: 'text', required: true, placeholder: 'Nom du paramètre/plante/unité...' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Détails...' },
  { name: 'fonctionPrincipale', label: 'Fonction Principale', type: 'textarea', placeholder: 'Usage herboristique principal...', conditional: (item) => ['cultureBase', 'ingredientGeneriqueRef'].includes(item?.type || '') },
  { name: 'valeur', label: 'Valeur/Symbole', type: 'text', placeholder: 'Ex: 1000 (KPI), g (Unité)', conditional: (item) => ['uniteMesure', 'kpiReference', 'categorieIntrant', 'autre'].includes(item?.type || '') },
  {
    name: 'unite',
    label: 'Unité Standard de Mesure',
    type: 'select',
    dynamicEntityType: 'parametresUniteMesure',
    placeholder: 'Sélectionner l\'unité (si applicable)',
    conditional: (item) => ['cultureBase', 'ingredientGeneriqueRef', 'intrantAgricoleRef'].includes(item?.type || '')
  },
];

const parametreItemFormConfigKpi: FormFieldConfig<ParametreItem>[] = [
    { 
        name: 'kpiKey', 
        label: 'Indicateur à Suivre', 
        type: 'select', 
        required: true,
        options: KPI_CONFIGS.map(k => ({ value: k.key, label: k.label })),
        placeholder: 'Sélectionner un indicateur automatique',
        autoFillFields: [
            { sourceField: 'label', targetFormField: 'nom' },
            { sourceField: (kpiConfig: any) => KPI_CONFIGS.find(k => k.label === kpiConfig.label)?.unit || '', targetFormField: 'unite' },
        ],
    },
    { name: 'nom', label: 'Nom d\'Affichage', type: 'text', required: true, placeholder: 'Nom de l\'indicateur sur le tableau de bord' },
    { name: 'valeur', label: 'Objectif (Valeur Cible)', type: 'number', required: true, placeholder: 'Ex: 50000 (pour revenu) ou 75 (pour % marge)' },
    { name: 'unite', label: 'Unité', type: 'text', disabled: true },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: '(Optionnel) Décrire cet indicateur ou son objectif' },
];

const produitFiniBaseFormConfig: FormFieldConfig<ProduitFiniBase>[] = [
    { name: 'nom', label: 'Nom du Produit Fini', type: 'text', required: true, placeholder: 'Ex: Tisane "Douce Nuit", Baume Calendula 50ml' },
    { name: 'categorie', label: 'Catégorie de Produit', type: 'text', placeholder: 'Ex: Tisane, Baume, Huile de massage' },
    { name: 'prixVenteUnitaire', label: 'Prix de Vente Unitaire (CAD)', type: 'number', step: '0.01', placeholder: 'Ex: 12.50' },
    {
      name: 'uniteVente',
      label: 'Unité de Vente',
      type: 'select',
      dynamicEntityType: 'parametresUniteMesure',
      placeholder: 'Sélectionner l\'unité de vente',
      required: true
    },
    { name: 'seuilReapprovisionnementPF', label: 'Seuil Stock Bas (unités)', type: 'number', placeholder: 'Ex: 10 (alerte si stock <= 10)' },
    { name: 'delaiAlerteDLUOPF', label: 'Délai Alerte DLUO (jours)', type: 'number', placeholder: 'Ex: 30 (alerte si DLUO dans <= 30 jours)' },
    { name: 'description', label: 'Description Courte', type: 'textarea', placeholder: 'Brève description du produit pour référence' },
];

const produitFiniBaseColumns: ColumnDefinition<ProduitFiniBase>[] = [
    { accessor: 'nom', Header: 'Nom Produit Fini', getSearchValue: item => item.nom },
    { accessor: 'categorie', Header: 'Catégorie', getSearchValue: item => item.categorie || '' },
    { accessor: 'prixVenteUnitaire', Header: 'Prix Vente (CAD)', cell: (item) => item.prixVenteUnitaire ? item.prixVenteUnitaire.toFixed(2) : '' },
    { accessor: 'uniteVente', Header: 'Unité Vente', getSearchValue: item => item.uniteVente || ''},
    { accessor: 'seuilReapprovisionnementPF', Header: 'Seuil Stock Bas' },
    { accessor: 'delaiAlerteDLUOPF', Header: 'Alerte DLUO (j)' },
];

const seuilIngredientGeneriqueFormConfig: FormFieldConfig<SeuilIngredientGenerique>[] = [
    {
        name: 'nomIngredient',
        label: 'Nom de l\'Ingrédient Acheté (Unique)',
        type: 'select',
        required: true,
        dynamicEntityType: 'ingredientsAchetesNomsUniques',
        placeholder: 'Sélectionner un nom d\'ingrédient existant',
    },
    { name: 'seuilGlobal', label: 'Seuil de Stock Global (tous lots)', type: 'number', required: true, placeholder: 'Ex: 500 (pour g, ml, etc.)' },
    { name: 'joursAlertePeremption', label: 'Délai Alerte Péremption (jours)', type: 'number', placeholder: 'Ex: 60 (alerte si péremption lot dans <= 60 jours)' },
];

const seuilIngredientGeneriqueColumns: ColumnDefinition<SeuilIngredientGenerique>[] = [
    { accessor: 'nomIngredient', Header: 'Nom Ingrédient', getSearchValue: item => item.nomIngredient },
    { accessor: 'seuilGlobal', Header: 'Seuil Stock Global' },
    { accessor: 'joursAlertePeremption', Header: 'Alerte Péremption (j)' },
];

const seuilConditionnementFormConfig: FormFieldConfig<SeuilConditionnement>[] = [
    {
        name: 'nomConditionnement',
        label: 'Nom du Conditionnement (Unique)',
        type: 'select',
        required: true,
        dynamicEntityType: 'conditionnementsNomsUniques',
        placeholder: 'Sélectionner un nom de conditionnement existant',
    },
    { name: 'seuilGlobal', label: 'Seuil de Stock Global (tous lots)', type: 'number', required: true, placeholder: 'Ex: 50' },
];

const seuilConditionnementColumns: ColumnDefinition<SeuilConditionnement>[] = [
    { accessor: 'nomConditionnement', Header: 'Nom Conditionnement', getSearchValue: item => item.nomConditionnement },
    { accessor: 'seuilGlobal', Header: 'Seuil Stock Global' },
];

const seuilIntrantAgricoleFormConfig: FormFieldConfig<SeuilIntrantAgricole>[] = [
    {
        name: 'nomIntrant',
        label: 'Nom de l\'Intrant Agricole (Unique)',
        type: 'select',
        required: true,
        dynamicEntityType: 'intrantsAgricolesNomsUniques',
        placeholder: 'Sélectionner un nom d\'intrant existant',
    },
    { name: 'seuilGlobal', label: 'Seuil de Stock Global (tous lots)', type: 'number', required: true, placeholder: 'Ex: 25' },
];

const seuilIntrantAgricoleColumns: ColumnDefinition<SeuilIntrantAgricole>[] = [
    { accessor: 'nomIntrant', Header: 'Nom Intrant', getSearchValue: item => item.nomIntrant },
    { accessor: 'seuilGlobal', Header: 'Seuil Stock Global' },
];

const companyInfoFormConfig: FormFieldConfig<CompanyInfo>[] = [
    { name: 'name', label: 'Nom de l\'entreprise', type: 'text', required: true },
    { name: 'address', label: 'Adresse', type: 'textarea', required: true },
    { name: 'phone', label: 'Téléphone', type: 'text' },
    { name: 'email', label: 'Email', type: 'text' },
    { name: 'website', label: 'Site Web', type: 'text' },
    { name: 'taxId', label: 'Numéros de Taxes', type: 'text' },
    { name: 'bankDetails', label: 'Coordonnées Bancaires (pour factures)', type: 'textarea', placeholder: 'Ex: Banque ABC - IBAN: FR... - BIC: ...' },
    { name: 'invoiceFooterText', label: 'Texte de bas de page des factures', type: 'textarea', placeholder: 'Ex: Merci de votre confiance.' },
];

const parametreColumns: ColumnDefinition<ParametreItem>[] = [
    { accessor: 'nom', Header: 'Nom' },
    { accessor: 'type', Header: 'Type' },
    { accessor: 'valeur', Header: 'Valeur/Symbole' },
    { accessor: 'unite', Header: 'Unité Standard' },
    { accessor: 'description', Header: 'Description' },
];

type ParamModalType = 'uniteMesure' | 'cultureBase' | 'ingredientGeneriqueRef' | 'conditionnementRef' | 'intrantAgricoleRef' | 'kpiReference' | 'autre' | 'produitFiniBase' | 'seuilIngredient' | 'seuilConditionnement' | 'seuilIntrant' | null;

const ParametresTab: React.FC<ParametresTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const {
      companyInfoData: companyInfo,
      parametresData: paramItems,
      produitsFiniBaseData: produitsFini,
      seuilsIngredientsGeneriquesData: seuilsIngredients,
      seuilsConditionnementsData: seuilsConditionnements,
      seuilsIntrantsAgricolesData: seuilsIntrants
  } = allData;
  
  const { addToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'references' | 'produitsFini' | 'seuils' | 'entreprise'>('references');
  const [modalType, setModalType] = useState<ParamModalType>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const handleOpenModal = (type: ParamModalType, item: any = null) => {
    setModalType(type);

    if (item) { // Edit mode
        setEditingItem(item);
        return;
    }

    // Add mode, create a default object to avoid issues with null initialData
    let newItem: any;
    switch (type) {
        case 'produitFiniBase':
            newItem = { nom: '', categorie: '', uniteVente: '' };
            break;
        case 'seuilIngredient':
            newItem = { nomIngredient: '', seuilGlobal: 0, joursAlertePeremption: 30 };
            break;
        case 'seuilConditionnement':
            newItem = { nomConditionnement: '', seuilGlobal: 0 };
            break;
        case 'seuilIntrant':
            newItem = { nomIntrant: '', seuilGlobal: 0 };
            break;
        case 'kpiReference':
            newItem = { type: 'kpiReference', nom: '', valeur: 0, unite: '' };
            break;
        default: // For all other ParametreItem types
            newItem = { type: type, nom: '' };
            break;
    }
    setEditingItem(newItem);
  };


  const handleCloseModal = () => {
    setModalType(null);
    setEditingItem(null);
  };
  
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) { // 200 KB size limit
        addToast("Le fichier du logo est trop grand. La taille maximale est de 200KB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
            const docRef = doc(db, 'companyInfoData', companyInfo.id);
            await updateDoc(docRef, { logoBase64: reader.result as string });
            addToast('Logo mis à jour avec succès.', 'success');
        } catch(error: any) {
            console.error("Error updating logo:", { code: error.code, message: error.message });
            addToast('Erreur lors de la mise à jour du logo.', 'error');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (data: any) => {
    const type = editingItem?.type || modalType;
    const isNew = !editingItem?.id;
    const { id, ...payload } = data; // Firestore handles ID generation

    logActivity({type: 'Paramètre', description: `Paramètre de type '${type}' ${isNew ? 'ajouté' : 'modifié'}: ${data.nom || data.nomIngredient || data.nomConditionnement || data.nomIntrant}`}, currentUser);
    
    let collectionName: string = 'parametresData';
    let docId = editingItem?.id;

    try {
        switch (modalType) {
            case 'produitFiniBase':         collectionName = 'produitsFiniBaseData'; break;
            case 'seuilIngredient':         collectionName = 'seuilsIngredientsGeneriquesData'; break;
            case 'seuilConditionnement':    collectionName = 'seuilsConditionnementsData'; break;
            case 'seuilIntrant':            collectionName = 'seuilsIntrantsAgricolesData'; break;
            default: // ParametreItem
                if (isNew) { payload.type = modalType; }
                break;
        }

        if (isNew) {
            await addDoc(collection(db, collectionName), payload);
        } else {
            await updateDoc(doc(db, collectionName, docId), payload);
        }

        addToast('Paramètre sauvegardé avec succès!', 'success');
        handleCloseModal();

    } catch(error: any) {
        console.error("Error saving parameter:", { code: error.code, message: error.message });
        addToast('Erreur lors de la sauvegarde du paramètre.', 'error');
    }
  };
  
  const handleDelete = async (id: string, type: ParamModalType) => {
    let collectionName: string = 'parametresData';

    switch (type) {
        case 'produitFiniBase': collectionName = 'produitsFiniBaseData'; break;
        case 'seuilIngredient': collectionName = 'seuilsIngredientsGeneriquesData'; break;
        case 'seuilConditionnement': collectionName = 'seuilsConditionnementsData'; break;
        case 'seuilIntrant': collectionName = 'seuilsIntrantsAgricolesData'; break;
        default: break;
    }

    try {
        await deleteDoc(doc(db, collectionName, id));
        addToast('Élément supprimé.', 'success');
        logActivity({type: 'Paramètre', description: `Paramètre de type '${type}' supprimé.`}, currentUser);
    } catch(error: any) {
        console.error("Error deleting item:", { code: error.code, message: error.message });
        addToast("Erreur lors de la suppression.", 'error');
    }
  }

  const handleCompanyInfoSubmit = async (data: Partial<CompanyInfo>) => {
    try {
        const { id, ...payload } = data;
        const docRef = doc(db, 'companyInfoData', companyInfo.id);
        await updateDoc(docRef, payload);
        addToast('Informations de l\'entreprise sauvegardées.', 'success');
        logActivity({type: 'Paramètre', description: `Informations de l'entreprise mises à jour.`}, currentUser);
    } catch (error: any) {
        console.error("Error saving company info:", { code: error.code, message: error.message });
        addToast('Erreur lors de la sauvegarde.', 'error');
    }
  };

  const { formConfig, modalTitle } = useMemo(() => {
    switch(modalType) {
        case 'produitFiniBase': return { modalTitle: editingItem?.id ? 'Modifier Produit' : 'Ajouter Produit', formConfig: produitFiniBaseFormConfig };
        case 'seuilIngredient': return { modalTitle: editingItem?.id ? 'Modifier Seuil' : 'Ajouter Seuil', formConfig: seuilIngredientGeneriqueFormConfig };
        case 'seuilConditionnement': return { modalTitle: editingItem?.id ? 'Modifier Seuil' : 'Ajouter Seuil', formConfig: seuilConditionnementFormConfig };
        case 'seuilIntrant': return { modalTitle: editingItem?.id ? 'Modifier Seuil' : 'Ajouter Seuil', formConfig: seuilIntrantAgricoleFormConfig };
        case 'kpiReference': return { modalTitle: editingItem?.id ? 'Modifier Objectif' : 'Ajouter Objectif', formConfig: parametreItemFormConfigKpi };
        case 'cultureBase':
        case 'ingredientGeneriqueRef':
        case 'conditionnementRef':
        case 'intrantAgricoleRef':
        case 'uniteMesure':
        case 'autre':
            return { modalTitle: editingItem?.id ? 'Modifier Référence' : 'Ajouter Référence', formConfig: baseParametreItemFormConfig };
        default: return { modalTitle: '', formConfig: [] };
    }
  }, [modalType, editingItem]);

  const renderSection = (title: string, dataType: ParamModalType, tableData: any[], tableCols: ColumnDefinition<any>[]) => (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-brand-dark">{title}</h3>
        <button onClick={() => handleOpenModal(dataType)} className="px-4 py-2 bg-brand-primary text-white rounded-md text-sm hover:bg-brand-dark">Ajouter</button>
      </div>
      <DataTable data={tableData} columns={tableCols} onEdit={(item) => handleOpenModal(dataType, item)} onDelete={(id) => handleDelete(id, dataType)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        {['references', 'produitsFini', 'seuils', 'entreprise'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab as any)}
            className={`capitalize px-4 py-2 font-medium text-sm ${activeSubTab === tab ? 'border-b-2 border-brand-primary text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'produitsFini' ? "Produits Finis" : tab}
          </button>
        ))}
      </div>

      {activeSubTab === 'references' && (
        <div className="space-y-4">
          {renderSection("Plantes de Culture (Base)", 'cultureBase', paramItems.filter(p => p.type === 'cultureBase'), parametreColumns)}
          {renderSection("Ingrédients Achetés (Référence)", 'ingredientGeneriqueRef', paramItems.filter(p => p.type === 'ingredientGeneriqueRef'), parametreColumns)}
          {renderSection("Conditionnements (Référence)", 'conditionnementRef', paramItems.filter(p => p.type === 'conditionnementRef'), parametreColumns)}
          {renderSection("Intrants Agricoles (Référence)", 'intrantAgricoleRef', paramItems.filter(p => p.type === 'intrantAgricoleRef'), parametreColumns)}
          {renderSection("Unités de Mesure", 'uniteMesure', paramItems.filter(p => p.type === 'uniteMesure'), parametreColumns)}
        </div>
      )}
      {activeSubTab === 'produitsFini' && renderSection("Catalogue Produits Finis", 'produitFiniBase', produitsFini, produitFiniBaseColumns)}
      {activeSubTab === 'seuils' && (
         <div className="space-y-4">
            {renderSection("Seuils d'Alerte - Ingrédients", 'seuilIngredient', seuilsIngredients, seuilIngredientGeneriqueColumns)}
            {renderSection("Seuils d'Alerte - Conditionnements", 'seuilConditionnement', seuilsConditionnements, seuilConditionnementColumns)}
            {renderSection("Seuils d'Alerte - Intrants Agricoles", 'seuilIntrant', seuilsIntrants, seuilIntrantAgricoleColumns)}
            {renderSection("Objectifs pour Indicateurs Automatisés", 'kpiReference', paramItems.filter(p => p.type === 'kpiReference'), parametreColumns)}
         </div>
      )}
      {activeSubTab === 'entreprise' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-brand-dark mb-4">Informations de l'Entreprise</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <DataForm<CompanyInfo>
                        formConfig={companyInfoFormConfig}
                        initialData={companyInfo}
                        onSubmit={handleCompanyInfoSubmit}
                        onCancel={() => { /* Optionally reset changes */ }}
                        isEditMode={true}
                        allData={allData}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                    <div className="mt-1 flex items-center">
                        {companyInfo.logoBase64 ? (
                            <img src={companyInfo.logoBase64} alt="Logo" className="h-24 w-24 object-contain rounded-md bg-gray-100 p-1 border" />
                        ) : (
                            <div className="h-24 w-24 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-xs text-center p-2">Aucun logo</div>
                        )}
                        <label htmlFor="logo-upload" className="ml-5 bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                            <span>Changer</span>
                            <input id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleLogoChange} accept="image/png, image/jpeg" />
                        </label>
                    </div>
                     <p className="text-xs text-gray-500 mt-2">Taille max: 200KB. Le logo est utilisé dans les rapports PDF.</p>
                </div>
            </div>
        </div>
      )}

      <Modal isOpen={!!modalType} onClose={handleCloseModal} title={modalTitle}>
        {modalType && (
            <DataForm
                formConfig={formConfig}
                initialData={editingItem}
                onSubmit={handleSubmit}
                onCancel={handleCloseModal}
                isEditMode={!!editingItem?.id}
                allData={allData}
            />
        )}
      </Modal>
    </div>
  );
};

export default ParametresTab;