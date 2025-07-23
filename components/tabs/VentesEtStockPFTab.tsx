

import React, { useState, useCallback, useMemo, useRef, useEffect, useContext } from 'react';
import { Vente, LotFabrication, ProduitFiniBase, ColumnDefinition, FormFieldConfig, AllData, Recette, User } from '../../types';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { DataContext } from '../DataContext';
import DataTable from '../DataTable';
import Modal from '../Modal';
import DataForm from '../DataForm';
import TabContentWrapper from '../TabContentWrapper';
import { formatDateForInput, isDateApproaching, manageVenteStockOnSave, manageVenteStockOnDelete, logActivity, generateInvoicePdf } from '../../utils/helpers';
import { useToast } from '../ToastProvider';
import { BanknotesIcon, ArchiveBoxIcon as StockIcon, ExclamationTriangleIcon, ClockIcon, ChevronDownIcon } from '../Icons';

interface VentesEtStockPFTabProps {
    currentUser: User;
}

const Dropdown: React.FC<{ buttonLabel: React.ReactNode; children: React.ReactNode }> = ({ buttonLabel, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <div>
                <button type="button" onClick={() => setIsOpen(!isOpen)} className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-3 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
                    {buttonLabel}
                    <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
                </button>
            </div>
            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {React.Children.map(children, child => {
                            if (!React.isValidElement<{ onClick?: () => void }>(child)) {
                                return child;
                            }
                            const originalOnClick = child.props.onClick;
                            return React.cloneElement(child, {
                                onClick: () => {
                                    setIsOpen(false);
                                    if (originalOnClick) {
                                        originalOnClick();
                                    }
                                }
                            });
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};


const VentesEtStockPFTab: React.FC<VentesEtStockPFTabProps> = ({ currentUser }) => {
  const { allData } = useContext(DataContext);
  const { ventesData: ventes, lotsFabricationData: lotsFabrication, produitsFiniBaseData: produitsFiniBase } = allData;
  const { addToast } = useToast();
  
  const [isVenteModalOpen, setIsVenteModalOpen] = useState(false);
  const [editingVente, setEditingVente] = useState<Vente | undefined>(undefined);
  const [activeSubTab, setActiveSubTab] = useState<'ventes' | 'stock'>('ventes');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'clone'>('add');

  const venteFormConfig: FormFieldConfig<Vente>[] = [
    { name: 'dateVente', label: 'Date', type: 'date', required: true },
    { 
        name: 'statut', 
        label: 'Statut de la Vente', 
        type: 'select', 
        required: true, 
        options: [
            { value: 'Proforma', label: 'Proforma' },
            { value: 'Facturée', label: 'Facturée' },
            { value: 'Payée', label: 'Payée' },
            { value: 'Annulée', label: 'Annulée' },
        ],
        placeholder: 'Sélectionner statut'
    },
    { 
      name: 'produitFiniBaseId', 
      label: 'Produit Vendu (Base)', 
      type: 'select', 
      required: true,
      dynamicEntityType: 'produitsFiniBase',
      valueFieldForDynamicOptions: 'id',
      labelFieldForDynamicOptions: 'nom',
      placeholder: 'Sélectionner le produit de base',
      autoFillFields: [
        { sourceField: 'nom', targetFormField: 'nomProduitVendu' },
        { sourceField: 'uniteVente', targetFormField: 'uniteVente' },
        { sourceField: 'prixVenteUnitaire', targetFormField: 'prixVenteUnitaire' },
      ]
    },
    { name: 'nomProduitVendu', label: 'Nom Produit (auto)', type: 'text', disabled: true },
    {
      name: 'lotFabricationId',
      label: 'Lot de Fabrication Spécifique',
      type: 'select',
      required: true,
      dynamicEntityType: 'lotsFabrication',
      valueFieldForDynamicOptions: 'id',
      labelFieldForDynamicOptions: (lot: LotFabrication) => {
        const stockRestant = (lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0);
        return `Lot: ${lot.lotNumeroProduitFini} (Stock: ${stockRestant} ${lot.uniteFabriquee || ''}, DLUO: ${lot.dluo ? formatDateForInput(lot.dluo) : 'N/A'})`;
      },
      placeholder: 'Sélectionner le lot fabriqué',
      filterContextField: 'produitFiniBaseId', 
      secondaryFilter: (lotOption: LotFabrication, currentVenteFormData: Partial<Vente>) => {
        const isCurrentlySelectedLotInForm = currentVenteFormData.lotFabricationId === lotOption.id;
        const recetteDuLot = allData.recettesData.find(r => r.id === lotOption.recetteId);
        const produitMatch = recetteDuLot?.produitFiniBaseId === currentVenteFormData.produitFiniBaseId;
        if (!produitMatch) return false;
        const stockDisponible = (lotOption.quantiteFabriquee || 0) - (lotOption.quantiteVendue || 0) > 0;
        if (isCurrentlySelectedLotInForm && modalMode === 'edit') return true;
        return lotOption.statut === 'Commercialisable' && stockDisponible;
      },
      autoFillFields: [ { sourceField: 'lotNumeroProduitFini', targetFormField: 'numeroLotVendu' } ]
    },
    { name: 'numeroLotVendu', label: 'N° Lot Vendu (auto)', type: 'text', disabled: true },
    { name: 'quantiteVendue', label: 'Quantité Vendue', type: 'number', required: true, step: '1' },
    { name: 'uniteVente', label: 'Unité (auto)', type: 'text', disabled: true },
    { name: 'prixVenteUnitaire', label: 'Prix Vente Unitaire (CAD)', type: 'number', required: true, step: '0.01' },
    { 
      name: 'prixVenteTotal' as any,
      label: 'Prix Vente Total (CAD, Calculé)',
      type: 'readonly_calculated',
      calculationFn: (formData) => (((formData.prixVenteUnitaire || 0) * (formData.quantiteVendue || 0)).toFixed(2)),
      dependsOn: ['prixVenteUnitaire', 'quantiteVendue'],
    },
    { name: 'client', label: 'Nom du Client', type: 'text' },
    { name: 'clientDetails', label: 'Détails Client (Adresse, etc.)', type: 'textarea' },
    { 
      name: 'canalVente', 
      label: 'Canal de Vente', 
      type: 'select', 
      options: [ { value: 'En ligne', label: 'En ligne' }, { value: 'Marché', label: 'Marché' }, { value: 'Boutique', label: 'Boutique' }, { value: 'Autre', label: 'Autre' } ],
      placeholder: 'Sélectionner canal de vente'
    },
    { name: 'paymentTerms', label: 'Conditions de Paiement', type: 'textarea', placeholder: 'Ex: Payable à 30 jours' },
    { name: 'notes', label: 'Notes Internes', type: 'textarea' },
  ];

  const getStatusBadge = (status: Vente['statut']) => {
    const baseClasses = "px-2 py-0.5 text-xs font-medium rounded-full inline-block";
    switch(status) {
        case 'Proforma': return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Proforma</span>;
        case 'Facturée': return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Facturée</span>;
        case 'Payée': return <span className={`${baseClasses} bg-green-100 text-green-800`}>Payée</span>;
        case 'Annulée': return <span className={`${baseClasses} bg-red-100 text-red-800`}>Annulée</span>;
        default: return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>
    }
  }

  const venteColumns: ColumnDefinition<Vente>[] = [
    { accessor: 'invoiceNumber', Header: 'N° Facture', getSearchValue: (item) => item.invoiceNumber },
    { accessor: 'dateVente', Header: 'Date', cell: item => formatDateForInput(item.dateVente), getSearchValue: (item) => item.dateVente },
    { accessor: 'client', Header: 'Client', getSearchValue: (item) => item.client || "" },
    { accessor: 'nomProduitVendu', Header: 'Produit', getSearchValue: (item) => item.nomProduitVendu || "" },
    { accessor: 'prixVenteTotal', Header: 'Total', cell: item => `${item.prixVenteTotal?.toFixed(2) || '0.00'} CAD` },
    { accessor: 'statut', Header: 'Statut', cell: item => getStatusBadge(item.statut) },
  ];

  const handleAddVenteItem = useCallback(() => {
    setEditingVente({
        id: '',
        dateVente: formatDateForInput(new Date().toISOString()),
        quantiteVendue: 1,
        statut: 'Proforma',
        paymentTerms: allData.companyInfoData.invoiceFooterText || 'Paiement à réception.',
    } as Vente);
    setModalMode('add');
    setIsVenteModalOpen(true);
  }, [allData.companyInfoData]);

  const handleEditVenteItem = useCallback((item: Vente) => {
    setEditingVente({ ...item, dateVente: formatDateForInput(item.dateVente) });
    setModalMode('edit');
    setIsVenteModalOpen(true);
  }, []);
  
   const handleCloneVenteItem = useCallback((item: Vente) => {
    const clonedItem = { 
      ...item, 
      id: '',
      invoiceNumber: '',
      dateVente: formatDateForInput(new Date().toISOString()),
      statut: 'Proforma' as Vente['statut'],
    };
    setEditingVente(clonedItem);
    setModalMode('clone');
    setIsVenteModalOpen(true);
  }, []);

  const handleDeleteItem = async (id: string) => {
    const venteToDelete = ventes.find(v => v.id === id);
    if (!venteToDelete) return;
    
    try {
        const stockResult = manageVenteStockOnDelete(venteToDelete, lotsFabrication);
        const batch = writeBatch(db);
        stockResult.updatedLots.forEach(lot => {
            const docRef = doc(db, "lotsFabricationData", lot.id);
            batch.update(docRef, { quantiteVendue: lot.quantiteVendue });
        });
        batch.delete(doc(db, "ventesData", id));
        await batch.commit();
        addToast("Vente supprimée et stock ajusté.", "success");
        logActivity({ type: 'Vente', description: `Vente #${venteToDelete.invoiceNumber} (${venteToDelete.nomProduitVendu}) supprimée.` }, currentUser);
    } catch(error: any) {
        console.error("Error deleting sale:", { code: error.code, message: error.message });
        addToast("Erreur lors de la suppression.", "error");
    }
  };

  const handleVenteFormSubmit = async (data: Partial<Vente>) => {
    const { id, ...payload } = data;
    const isNew = modalMode !== 'edit';
    const oldVente = isNew ? null : ventes.find(v => v.id === editingVente!.id);
    
    if (isNew || !payload.invoiceNumber) {
        const prefix = payload.statut === 'Proforma' ? 'PRO' : 'INV';
        const year = new Date(payload.dateVente!).getFullYear();
        const salesOfTheTypeThisYear = ventes.filter(v => v.invoiceNumber?.startsWith(`${prefix}-${year}`));
        const nextNumber = salesOfTheTypeThisYear.length + 1;
        payload.invoiceNumber = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
    }

    payload.prixVenteTotal = (payload.prixVenteUnitaire || 0) * (payload.quantiteVendue || 0);

    const stockResult = manageVenteStockOnSave(oldVente, payload as Vente, lotsFabrication);
    
    if (!stockResult.success) {
        addToast(stockResult.errorMessage || "Erreur de gestion de stock.", "error");
        return;
    }
    
    try {
        const batch = writeBatch(db);
        stockResult.updatedLots!.forEach(lot => {
            batch.update(doc(db, "lotsFabricationData", lot.id), {quantiteVendue: lot.quantiteVendue});
        });
        
        if (isNew) {
            batch.set(doc(collection(db, "ventesData")), payload);
        } else {
            batch.update(doc(db, "ventesData", editingVente!.id), payload);
        }
        await batch.commit();
        addToast(`Vente ${isNew ? 'ajoutée' : 'modifiée'}.`, "success");
        logActivity({ type: 'Vente', description: `Vente #${payload.invoiceNumber} (${payload.nomProduitVendu}) ${isNew ? 'créée' : 'modifiée'}.` }, currentUser);
        setIsVenteModalOpen(false);
        setEditingVente(undefined);
    } catch (error: any) {
        console.error("Error saving sale:", { code: error.code, message: error.message });
        addToast("Erreur lors de la sauvegarde.", "error");
    }
  };


  const stockPfColumns: ColumnDefinition<LotFabrication>[] = [
    { accessor: (item) => item.nomProduitFini, Header: 'Produit Fini', getSearchValue: item => item.nomProduitFini || ""},
    { accessor: 'lotNumeroProduitFini', Header: 'N° Lot', getSearchValue: item => item.lotNumeroProduitFini},
    {
      accessor: (item) => {
        const stockRestant = (item.quantiteFabriquee || 0) - (item.quantiteVendue || 0);
        const pfb = produitsFiniBase.find(p => p.nom === item.nomProduitFini); 
        
        let stockClass = '';
        let stockIcon = null;

        if (pfb && pfb.seuilReapprovisionnementPF && stockRestant < pfb.seuilReapprovisionnementPF) {
            stockClass = stockRestant <= pfb.seuilReapprovisionnementPF / 2 ? 'text-red-700 font-bold' : 'text-amber-600 font-semibold';
            stockIcon = <ExclamationTriangleIcon className={`w-4 h-4 inline-block mr-1 ${stockClass}`} />;
        }
        
        return <span className={stockClass}>{stockIcon}{stockRestant}</span>;
      },
      Header: 'Stock Restant'
    },
    { accessor: 'uniteFabriquee', Header: 'Unité', getSearchValue: item => item.uniteFabriquee},
    { 
      accessor: 'dluo', 
      Header: 'DLUO', 
      cell: item => {
        if (!item.dluo) return 'N/A';
        const pfb = produitsFiniBase.find(p => p.nom === item.nomProduitFini);
        const daysAdvance = pfb?.delaiAlerteDLUOPF ?? 30;
        let dluoClass = '';
        let dluoIcon = null;

        if (isDateApproaching(item.dluo, daysAdvance)) {
             const today = new Date(); today.setHours(0,0,0,0);
             const dluoDate = new Date(item.dluo); dluoDate.setHours(0,0,0,0);
             const diffDays = Math.ceil((dluoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
             dluoClass = diffDays <= 7 ? 'text-red-600 font-semibold' : 'text-amber-600';
             dluoIcon = <ClockIcon className={`w-3 h-3 inline-block mr-1 ${dluoClass}`} />;
        }
        return <span className={dluoClass}>{dluoIcon}{formatDateForInput(item.dluo)}</span>;
      },
      getSearchValue: item => item.dluo || ""
    },
    { accessor: 'statut', Header: 'Statut Lot', getSearchValue: item => item.statut},
  ];
  
  const commercialisableLots = useMemo(() => {
    return lotsFabrication.filter(lot => lot.statut === 'Commercialisable' && ((lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0) > 0));
  }, [lotsFabrication]);

  const handleUpdateStatus = async (vente: Vente, newStatus: Vente['statut']) => {
    if (vente.statut === newStatus) return;

    const oldVente = {...vente};
    const newVente = {...vente, statut: newStatus};
    
    if(newStatus === 'Facturée' && oldVente.statut === 'Proforma') {
        const prefix = 'INV';
        const year = new Date(newVente.dateVente).getFullYear();
        const salesOfTheTypeThisYear = ventes.filter(v => v.invoiceNumber?.startsWith(`${prefix}-${year}`));
        const nextNumber = salesOfTheTypeThisYear.length + 1;
        newVente.invoiceNumber = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
    }

    const stockResult = manageVenteStockOnSave(oldVente, newVente, lotsFabrication);
    if (!stockResult.success) {
        addToast(stockResult.errorMessage || "Erreur de gestion de stock.", "error");
        return;
    }
    
    try {
        const batch = writeBatch(db);
        stockResult.updatedLots!.forEach(lot => batch.update(doc(db, "lotsFabricationData", lot.id), {quantiteVendue: lot.quantiteVendue}));
        batch.update(doc(db, "ventesData", newVente.id), {statut: newStatus, invoiceNumber: newVente.invoiceNumber});
        await batch.commit();
        addToast(`Statut mis à jour à "${newStatus}".`, 'success');
    } catch(error: any) {
        console.error("Error updating status:", { code: error.code, message: error.message });
        addToast("Erreur lors de la mise à jour du statut.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-brand-dark">Ventes de Produits Finis &amp; Stock PF</h2>
        <div className="flex space-x-1 p-1 bg-gray-200 rounded-lg">
          <button onClick={() => setActiveSubTab('ventes')} className={`px-4 py-1.5 text-sm font-medium rounded-md ${activeSubTab === 'ventes' ? 'bg-white text-brand-primary shadow' : 'text-gray-600 hover:bg-gray-300'}`}>
            <BanknotesIcon className="w-5 h-5 inline-block mr-2" />
            Ventes de Produits Finis
          </button>
          <button onClick={() => setActiveSubTab('stock')} className={`px-4 py-1.5 text-sm font-medium rounded-md ${activeSubTab === 'stock' ? 'bg-white text-brand-primary shadow' : 'text-gray-600 hover:bg-gray-300'}`}>
            <StockIcon className="w-5 h-5 inline-block mr-2" />
            Inventaire des Produits Finis
          </button>
        </div>
      </div>

      {activeSubTab === 'ventes' && (
        <TabContentWrapper title="" onAddItem={handleAddVenteItem} addButtonLabel="+ Nouvelle Vente">
          <DataTable
            data={ventes.sort((a, b) => new Date(b.dateVente).getTime() - new Date(a.dateVente).getTime())}
            columns={venteColumns}
            onEdit={handleEditVenteItem}
            onDelete={handleDeleteItem}
            onClone={handleCloneVenteItem}
            renderActions={(item) => (
              <Dropdown buttonLabel="Actions">
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => generateInvoicePdf('proforma', item, allData)}>
                    PDF Proforma
                </button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => generateInvoicePdf('commercial', item, allData)}>
                    PDF Facture
                </button>
                <div className="border-t my-1"></div>
                {item.statut !== 'Facturée' && <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => handleUpdateStatus(item, 'Facturée')}>Passer à 'Facturée'</button>}
                {item.statut !== 'Payée' && <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => handleUpdateStatus(item, 'Payée')}>Passer à 'Payée'</button>}
                {item.statut !== 'Annulée' && <button className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50" onClick={() => handleUpdateStatus(item, 'Annulée')}>Annuler</button>}
                <div className="border-t my-1"></div>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => handleEditVenteItem(item)}>Modifier</button>
                <button className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => handleCloneVenteItem(item)}>Cloner</button>
                <button className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50" onClick={() => handleDeleteItem(item.id)}>Supprimer</button>
              </Dropdown>
            )}
          />
        </TabContentWrapper>
      )}

      {activeSubTab === 'stock' && (
        <div className="bg-white p-4 rounded-lg shadow">
           <h3 className="text-xl font-semibold text-brand-dark mb-4">Stock Actuel des Produits Finis Commercialisables</h3>
           <DataTable
             data={commercialisableLots}
             columns={stockPfColumns}
             onEdit={(item) => alert("Pour modifier un lot, allez à l'onglet 'Lots Fabrication'.")}
             onDelete={(id) => alert("Pour supprimer un lot, allez à l'onglet 'Lots Fabrication'.")}
           />
        </div>
      )}
      
      <Modal
        isOpen={isVenteModalOpen}
        onClose={() => setIsVenteModalOpen(false)}
        title={modalMode === 'add' ? "Ajouter une Vente" : (modalMode === 'edit' ? "Modifier la Vente" : "Cloner la Vente")}
      >
        {isVenteModalOpen && (
            <DataForm<Vente>
                formConfig={venteFormConfig}
                initialData={editingVente}
                onSubmit={handleVenteFormSubmit}
                onCancel={() => setIsVenteModalOpen(false)}
                isEditMode={modalMode !== 'add'}
                allData={allData}
            />
        )}
      </Modal>
    </div>
  );
};

export default VentesEtStockPFTab;