
import { AllData, AlertItem, AlertType, TabKey, SeuilIntrantAgricole } from '../types';
import { isDateApproaching, formatDateForInput } from './dateUtils'; // Updated import

const checkLowStockGenericIngredients = (allData: AllData): AlertItem[] => {
  const alerts: AlertItem[] = [];
  allData.seuilsIngredientsGeneriquesData.forEach(seuil => {
    const totalStock = allData.ingredientsAchetesData
      .filter(ing => ing.nom === seuil.nomIngredient)
      .reduce((sum, ing) => sum + (ing.quantiteRestante || 0), 0);

    if (totalStock < seuil.seuilGlobal) {
      alerts.push({
        id: `lowstock-ing-${seuil.nomIngredient.replace(/\s+/g, '-')}`,
        type: 'LOW_STOCK_INGREDIENT_GENERIC',
        itemName: seuil.nomIngredient,
        message: `Stock: ${totalStock} / Seuil: ${seuil.seuilGlobal}`,
        currentValue: totalStock,
        thresholdValue: seuil.seuilGlobal,
        severity: totalStock < seuil.seuilGlobal / 2 ? 'critical' : 'warning',
        relatedTabKey: 'ingredientsAchetes'
      });
    }
  });
  return alerts;
};

const checkExpiryIngredientLots = (allData: AllData): AlertItem[] => {
  const alerts: AlertItem[] = [];
  allData.ingredientsAchetesData.forEach(lot => {
    if (lot.datePeremption && lot.quantiteRestante > 0) {
      const seuilGenerique = allData.seuilsIngredientsGeneriquesData.find(s => s.nomIngredient === lot.nom);
      const daysAdvance = seuilGenerique?.joursAlertePeremption ?? 30; // Default to 30 days if not set

      if (isDateApproaching(lot.datePeremption, daysAdvance)) {
        const today = new Date(); today.setHours(0,0,0,0);
        const expiryDate = new Date(lot.datePeremption); expiryDate.setHours(0,0,0,0);
        const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        alerts.push({
          id: `expiry-inglot-${lot.id}`,
          type: 'EXPIRY_INGREDIENT_LOT',
          itemName: `${lot.nom} (Lot: ${lot.numeroLotFournisseur || lot.id.substring(0,6)})`,
          lotNumero: lot.numeroLotFournisseur || lot.id.substring(0,6),
          message: diffDays <=0 ? `A PÉRIMÉ le ${formatDateForInput(lot.datePeremption)}` : `Périme dans ${diffDays} jour(s) (le ${formatDateForInput(lot.datePeremption)})`,
          currentValue: diffDays,
          thresholdValue: daysAdvance,
          severity: diffDays <= 7 ? 'critical' : 'warning',
          relatedTabKey: 'ingredientsAchetes',
          relatedItemId: lot.id
        });
      }
    }
  });
  return alerts;
};

const checkLowStockPackaging = (allData: AllData): AlertItem[] => {
  const alerts: AlertItem[] = [];
  allData.seuilsConditionnementsData.forEach(seuil => {
    const totalStock = allData.conditionnementsData
      .filter(cond => cond.nom === seuil.nomConditionnement)
      .reduce((sum, cond) => sum + (cond.quantiteRestante || 0), 0);

    if (totalStock < seuil.seuilGlobal) {
      alerts.push({
        id: `lowstock-cond-${seuil.nomConditionnement.replace(/\s+/g, '-')}`,
        type: 'LOW_STOCK_PACKAGING',
        itemName: seuil.nomConditionnement,
        message: `Stock: ${totalStock} / Seuil: ${seuil.seuilGlobal}`,
        currentValue: totalStock,
        thresholdValue: seuil.seuilGlobal,
        severity: totalStock < seuil.seuilGlobal / 2 ? 'critical' : 'warning',
        relatedTabKey: 'conditionnements',
        relatedItemId: seuil.id,
      });
    }
  });
  return alerts;
};

const checkLowStockAgriculturalInputs = (allData: AllData): AlertItem[] => {
  const alerts: AlertItem[] = [];
  allData.seuilsIntrantsAgricolesData.forEach(seuil => {
    const lotsOfThisIntrant = allData.intrantsAgricolesData.filter(intrant => intrant.nom === seuil.nomIntrant);
    const totalStock = lotsOfThisIntrant.reduce((sum, lot) => sum + (lot.quantiteRestante || 0), 0);
    const unit = lotsOfThisIntrant.length > 0 ? lotsOfThisIntrant[0].unite : '';

    if (totalStock < seuil.seuilGlobal) {
      alerts.push({
        id: `lowstock-agrin-${seuil.nomIntrant.replace(/\s+/g, '-')}`,
        type: 'LOW_STOCK_AGRICULTURAL_INPUT',
        itemName: seuil.nomIntrant,
        message: `Stock: ${totalStock.toFixed(2)} ${unit} / Seuil: ${seuil.seuilGlobal} ${unit}`,
        currentValue: totalStock,
        thresholdValue: seuil.seuilGlobal,
        severity: totalStock < seuil.seuilGlobal / 2 ? 'critical' : 'warning',
        relatedTabKey: 'intrantsAgricoles',
        relatedItemId: seuil.id
      });
    }
  });
  return alerts;
};


const checkLowStockFinishedProducts = (allData: AllData): AlertItem[] => {
  const alerts: AlertItem[] = [];
  allData.produitsFiniBaseData.forEach(pfb => {
    if (pfb.seuilReapprovisionnementPF && pfb.seuilReapprovisionnementPF > 0) {
      const lotsAssocies = allData.lotsFabricationData.filter(lot => {
        const recette = allData.recettesData.find(r => r.id === lot.recetteId);
        return recette?.produitFiniBaseId === pfb.id && lot.statut === 'Commercialisable';
      });
      const quantiteTotaleDisponible = lotsAssocies.reduce((sum, lot) => {
        return sum + ((lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0));
      }, 0);

      if (quantiteTotaleDisponible < pfb.seuilReapprovisionnementPF) {
        alerts.push({
          id: `lowstock-pfb-${pfb.id}`,
          type: 'LOW_STOCK_FINISHED_PRODUCT',
          itemName: pfb.nom,
          message: `Stock Dispo: ${quantiteTotaleDisponible} ${pfb.uniteVente || ''} / Seuil: ${pfb.seuilReapprovisionnementPF} ${pfb.uniteVente || ''}`,
          currentValue: quantiteTotaleDisponible,
          thresholdValue: pfb.seuilReapprovisionnementPF,
          severity: quantiteTotaleDisponible < pfb.seuilReapprovisionnementPF / 2 ? 'critical' : 'warning',
          relatedTabKey: 'ventesEtStockPF', // Links to the stock view
          relatedItemId: pfb.id
        });
      }
    }
  });
  return alerts;
};

const checkDLUOFinishedProductLots = (allData: AllData): AlertItem[] => {
  const alerts: AlertItem[] = [];
  allData.lotsFabricationData.forEach(lot => {
    if (lot.dluo && lot.statut === 'Commercialisable' && ((lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0)) > 0) {
      const recette = allData.recettesData.find(r => r.id === lot.recetteId);
      const produitFiniBase = allData.produitsFiniBaseData.find(pfb => pfb.id === recette?.produitFiniBaseId);
      const daysAdvance = produitFiniBase?.delaiAlerteDLUOPF ?? 30; // Default 30 days

      if (isDateApproaching(lot.dluo, daysAdvance)) {
        const today = new Date(); today.setHours(0,0,0,0);
        const dluoDate = new Date(lot.dluo); dluoDate.setHours(0,0,0,0);
        const diffDays = Math.ceil((dluoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        alerts.push({
          id: `dluo-lotfab-${lot.id}`,
          type: 'DLUO_FINISHED_PRODUCT_LOT',
          itemName: `${lot.nomProduitFini} (Lot: ${lot.lotNumeroProduitFini})`,
          lotNumero: lot.lotNumeroProduitFini,
          message: diffDays <=0 ? `DLUO ATTEINTE le ${formatDateForInput(lot.dluo)}` : `DLUO dans ${diffDays} jour(s) (le ${formatDateForInput(lot.dluo)})`,
          currentValue: diffDays,
          thresholdValue: daysAdvance,
          severity: diffDays <= 7 ? 'critical' : 'warning',
          relatedTabKey: 'lotsFabrication',
          relatedItemId: lot.id
        });
      }
    }
  });
  return alerts;
};

export const getAllInventoryAlerts = (allData: AllData): AlertItem[] => {
  return [
    ...checkLowStockGenericIngredients(allData),
    ...checkExpiryIngredientLots(allData),
    ...checkLowStockPackaging(allData),
    ...checkLowStockAgriculturalInputs(allData),
    ...checkLowStockFinishedProducts(allData),
    ...checkDLUOFinishedProductLots(allData),
  ].sort((a,b) => { // Sort critical alerts first, then by type
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return a.type.localeCompare(b.type);
  });
};
