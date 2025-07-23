
import { 
  Recolte, IntrantAgricole, LotFabrication, AllData, EtapeTransformation, Vente, ParametreItem, KPIKey, Culture
} from '../types';

export const calculateIntrantAgricoleCoutUnitaire = (intrant: Partial<IntrantAgricole>): number => {
  if (intrant.coutTotalAchat != null && intrant.quantiteInitiale != null && intrant.quantiteInitiale > 0) {
    return intrant.coutTotalAchat / intrant.quantiteInitiale;
  }
  return 0;
};

export const calculateCultureCost = (
  culture: Partial<Culture>,
  allData: AllData
): number => {
  let totalCost = 0;
  
  // Cost of workers for the culture
  culture.travailleurs?.forEach(ht => {
    const travailleur = allData.travailleursData.find(t => t.id === ht.travailleurId);
    if (travailleur && travailleur.tauxHoraire) {
      totalCost += (ht.heures || 0) * travailleur.tauxHoraire;
    }
  });

  // Cost of inputs for the culture
  culture.intrantsUtilises?.forEach(iu => {
    const intrantLot = allData.intrantsAgricolesData.find(i => i.id === iu.intrantId);
    if (intrantLot && intrantLot.coutUnitaire) {
      totalCost += (iu.quantiteUtilisee || 0) * intrantLot.coutUnitaire;
    }
  });

  return totalCost;
};


export const calculateRecolteCost = (
  recolte: Partial<Recolte>, 
  allData: AllData
): { coutProductionTotalEstime: number; coutUnitaireApresSechageEstime: number } => {
  
  // 1. Calculate costs specific to the harvest event
  let coutMO = 0;
  if (recolte.travailleurs) {
    recolte.travailleurs.forEach(ht => {
      const travailleur = allData.travailleursData.find(t => t.id === ht.travailleurId);
      if (travailleur && travailleur.tauxHoraire) {
        coutMO += ht.heures * travailleur.tauxHoraire;
      }
    });
  }

  let coutIntrants = 0;
  if (recolte.intrantsUtilises) {
    recolte.intrantsUtilises.forEach(iu => {
      const intrantLot = allData.intrantsAgricolesData.find(i => i.id === iu.intrantId);
      if (intrantLot && intrantLot.coutUnitaire) {
        coutIntrants += iu.quantiteUtilisee * intrantLot.coutUnitaire;
      }
    });
  }
  
  // 2. Add costs from the parent culture
  let coutCulture = 0;
  if (recolte.cultureId) {
      const culture = allData.culturesData.find(c => c.id === recolte.cultureId);
      if (culture) {
          // Use the pre-calculated cost stored on the culture object if available,
          // otherwise calculate it on the fly.
          coutCulture = culture.coutProductionCultureEstime ?? calculateCultureCost(culture, allData);
      }
  }

  // 3. Sum all costs
  const coutProductionTotalEstime = coutMO + coutIntrants + coutCulture;

  // 4. Calculate unit cost
  const coutUnitaireApresSechageEstime = (recolte.poidsApresSechage && recolte.poidsApresSechage > 0)
    ? coutProductionTotalEstime / recolte.poidsApresSechage
    : 0;

  return { coutProductionTotalEstime, coutUnitaireApresSechageEstime };
};

export const calculateLotFabricationCost = (
  lotFab: Partial<LotFabrication>,
  allRelevantData: AllData
): { prixRevientUnitaireEstime: number } => {
  const {
    recettesData: allRecettes,
    recoltesData: allRecoltes,
    ingredientsAchetesData: allIngredientsAchetes, 
    conditionnementsData: allConditionnements,
    travailleursData: allTravailleurs,
    etapesTransformationData: allEtapesTransformation,
    culturesData: allCultures
  } = allRelevantData;

  let coutTotalComposants = 0;
  lotFab.composantsUtilises?.forEach(compUsed => {
    if (compUsed.typeComposant === 'IngredientAchete') {
      const ingLotUtilise = allIngredientsAchetes.find(lot => lot.id === compUsed.lotUtiliseId);
      if (ingLotUtilise && ingLotUtilise.coutUnitaire) {
        coutTotalComposants += compUsed.quantitePrelevee * ingLotUtilise.coutUnitaire;
      }
    } else if (compUsed.typeComposant === 'PlanteCultivee') {
      let coutUnitairePlante = 0;
      const recolteSource = allRecoltes.find(rec => rec.id === compUsed.lotUtiliseId);
      if (recolteSource) {
          coutUnitairePlante = recolteSource.coutUnitaireApresSechageEstime || 0;
          if (coutUnitairePlante === 0) { 
            const { coutUnitaireApresSechageEstime: cost } = calculateRecolteCost(recolteSource, allRelevantData);
            coutUnitairePlante = cost;
          }
      } else {
          const etapeTransfoSource = allEtapesTransformation.find(et => et.lotSortantId === compUsed.lotUtiliseId);
          if (etapeTransfoSource && typeof etapeTransfoSource.coutUnitaireSortantEstime === 'number') {
              coutUnitairePlante = etapeTransfoSource.coutUnitaireSortantEstime;
          }
      }
       if (coutUnitairePlante > 0) {
         coutTotalComposants += compUsed.quantitePrelevee * coutUnitairePlante;
       }
    }
  });

  let coutTotalConditionnements = 0;
  lotFab.conditionnementsUtilises?.forEach(condUsed => {
    const cond = allConditionnements.find(c => c.id === condUsed.conditionnementId);
    if (cond && cond.coutUnitaire) {
      coutTotalConditionnements += condUsed.quantite * cond.coutUnitaire;
    }
  });

  let coutMOFabrication = 0;
  lotFab.travailleurs?.forEach(ht => {
    const travailleur = allTravailleurs.find(t => t.id === ht.travailleurId);
    if (travailleur && travailleur.tauxHoraire) {
      coutMOFabrication += ht.heures * travailleur.tauxHoraire;
    }
  });

  const coutTotalFabrication = coutTotalComposants + coutTotalConditionnements + coutMOFabrication;
  const prixRevientUnitaireEstime = (lotFab.quantiteFabriquee && lotFab.quantiteFabriquee > 0)
    ? coutTotalFabrication / lotFab.quantiteFabriquee
    : 0;
    
  return { prixRevientUnitaireEstime };
};

export const calculateEtapeTransformationCost = (
  etape: Partial<EtapeTransformation>,
  allData: AllData
): { 
  coutMatiereEntranteEstime: number; 
  coutTravailDeLEtape: number; 
  coutTotalEtapeEstime: number; 
  coutUnitaireSortantEstime: number; 
} => {
  let coutTravailDeLEtape = 0;
  etape.travailleurs?.forEach(ht => {
    const travailleur = allData.travailleursData.find(t => t.id === ht.travailleurId);
    if (travailleur && travailleur.tauxHoraire) {
      coutTravailDeLEtape += ht.heures * travailleur.tauxHoraire;
    }
  });

  let coutMatiereEntranteEstime = 0;
  if (etape.lotEntrantId && etape.quantiteEntrante && etape.quantiteEntrante > 0) {
    if (etape.typeLotEntrant === 'Recolte') {
      const recolteSource = allData.recoltesData.find(r => r.id === etape.lotEntrantId);
      if (recolteSource) {
        const cost = recolteSource.coutUnitaireApresSechageEstime ?? calculateRecolteCost(recolteSource, allData).coutUnitaireApresSechageEstime;
        if (cost) {
           coutMatiereEntranteEstime = etape.quantiteEntrante * cost;
        }
      }
    } else if (etape.typeLotEntrant === 'EtapeTransformationPrecedente') {
      const etapePrecedente = allData.etapesTransformationData.find(et => et.id === etape.lotEntrantId);
      if (etapePrecedente && etapePrecedente.coutUnitaireSortantEstime) {
        coutMatiereEntranteEstime = etape.quantiteEntrante * etapePrecedente.coutUnitaireSortantEstime;
      }
    }
  }

  const coutTotalEtapeEstime = (coutMatiereEntranteEstime || 0) + (coutTravailDeLEtape || 0);
  const coutUnitaireSortantEstime = (etape.quantiteSortante && etape.quantiteSortante > 0)
    ? coutTotalEtapeEstime / etape.quantiteSortante
    : 0;

  return { 
    coutMatiereEntranteEstime: coutMatiereEntranteEstime || 0,
    coutTravailDeLEtape: coutTravailDeLEtape || 0,
    coutTotalEtapeEstime, 
    coutUnitaireSortantEstime 
  };
};

export const calculateVenteDetails = (
  vente: Vente,
  lotFabrication: LotFabrication | undefined
): { coutRevientVendu: number; margeBruteAbsolue: number; margeBrutePourcentage: number } => {
  
  const defaults = { coutRevientVendu: 0, margeBruteAbsolue: 0, margeBrutePourcentage: 0 };

  if (!lotFabrication || typeof lotFabrication.prixRevientUnitaireEstime !== 'number') {
    return defaults;
  }
  
  const prixRevientUnitaire = lotFabrication.prixRevientUnitaireEstime;
  const quantiteVendue = vente.quantiteVendue || 0;
  const prixVenteTotal = vente.prixVenteTotal || 0;

  const coutRevientVendu = prixRevientUnitaire * quantiteVendue;
  const margeBruteAbsolue = prixVenteTotal - coutRevientVendu;
  
  let margeBrutePourcentage = 0;
  if (prixVenteTotal !== 0) {
    margeBrutePourcentage = (margeBruteAbsolue / prixVenteTotal) * 100;
  }

  return { 
    coutRevientVendu, 
    margeBruteAbsolue, 
    margeBrutePourcentage 
  };
};

export type CalculatedKpi = {
  value: number;
  formatted: string;
};

export const calculateKpiSet = (allData: AllData): Map<KPIKey, CalculatedKpi> => {
    const kpiResults = new Map<KPIKey, CalculatedKpi>();

    // Financial KPIs
    const totalRevenue = allData.ventesData.reduce((sum, v) => sum + (v.prixVenteTotal || 0), 0);
    kpiResults.set('TOTAL_REVENUE', { value: totalRevenue, formatted: `${totalRevenue.toFixed(2)} CAD` });

    const totalCogs = allData.ventesData.reduce((sum, v) => {
        const lot = allData.lotsFabricationData.find(l => l.id === v.lotFabricationId);
        return sum + calculateVenteDetails(v, lot).coutRevientVendu;
    }, 0);
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0;
    kpiResults.set('GLOBAL_GROSS_MARGIN', { value: grossMargin, formatted: `${grossMargin.toFixed(1)} %` });

    const avgSaleValue = allData.ventesData.length > 0 ? totalRevenue / allData.ventesData.length : 0;
    kpiResults.set('AVG_SALE_VALUE', { value: avgSaleValue, formatted: `${avgSaleValue.toFixed(2)} CAD` });

    // Stock Value KPIs
    const ingredientStockValue = allData.ingredientsAchetesData.reduce((sum, i) => sum + (i.quantiteRestante * (i.coutUnitaire || 0)), 0);
    kpiResults.set('INGREDIENT_STOCK_VALUE', { value: ingredientStockValue, formatted: `${ingredientStockValue.toFixed(2)} CAD` });
    
    const packagingStockValue = allData.conditionnementsData.reduce((sum, c) => sum + (c.quantiteRestante * (c.coutUnitaire || 0)), 0);
    kpiResults.set('PACKAGING_STOCK_VALUE', { value: packagingStockValue, formatted: `${packagingStockValue.toFixed(2)} CAD` });

    const finishedGoodsStockValue = allData.lotsFabricationData
        .filter(lot => lot.statut === 'Commercialisable' && lot.prixRevientUnitaireEstime)
        .reduce((sum, lot) => {
            const stockRestant = (lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0);
            return sum + (stockRestant * (lot.prixRevientUnitaireEstime || 0));
        }, 0);
    kpiResults.set('FINISHED_GOODS_STOCK_VALUE', { value: finishedGoodsStockValue, formatted: `${finishedGoodsStockValue.toFixed(2)} CAD`});

    // Activity KPIs
    const totalSalesCount = allData.ventesData.length;
    kpiResults.set('TOTAL_SALES_COUNT', { value: totalSalesCount, formatted: totalSalesCount.toString() });

    const totalProductionLots = allData.lotsFabricationData.length;
    kpiResults.set('TOTAL_PRODUCTION_LOTS', { value: totalProductionLots, formatted: totalProductionLots.toString() });

    return kpiResults;
};
