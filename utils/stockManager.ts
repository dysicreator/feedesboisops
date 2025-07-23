
import {
    AllData, LotFabrication, Conditionnement, IngredientAchete, Recolte, EtapeTransformation,
    IntrantAgricole, Vente, ConditionnementUtilise, ComposantLotFabrication, CoutIntrantUtilise
} from '../types';
import { formatDateForInput } from './dateUtils';


// --- Constants for Statuses ---
const LOT_FABRICATION_STOCK_DEDUCTING_STATUSES: LotFabrication['statut'][] = ['Fabriquée', 'Commercialisable', 'Contrôle Qualité'];
const RECOLTE_STOCK_DEDUCTING_STATUSES: Recolte['statut'][] = ['Récoltée', 'Séchage en cours', 'Séchée'];

// --- Internal Helper Functions ---

const _tryApplyConditionnementStockChanges = (
    items: ConditionnementUtilise[] | undefined,
    factor: 1 | -1, // 1 for deduction, -1 for re-credit
    currentConds: Conditionnement[]
): { success: boolean; updatedConditionnements: Conditionnement[]; errorMessage?: string } => {
    if (!items || items.length === 0) return { success: true, updatedConditionnements: [...currentConds] };

    let clonedConds = currentConds.map(c => ({ ...c }));
    let errorMessage = '';

    if (factor === 1) { // Deduction
        for (const itemUsed of items) {
            const idx = clonedConds.findIndex(c => c.id === itemUsed.conditionnementId);
            if (idx > -1) {
                if ((clonedConds[idx].quantiteRestante || 0) < itemUsed.quantite) {
                    errorMessage = `Stock insuffisant pour le conditionnement ${clonedConds[idx].nom}. Requis: ${itemUsed.quantite}, Disponible: ${clonedConds[idx].quantiteRestante || 0}`;
                    return { success: false, updatedConditionnements: currentConds, errorMessage };
                }
                clonedConds[idx].quantiteRestante = (clonedConds[idx].quantiteRestante || 0) - itemUsed.quantite;
            } else {
                 errorMessage = `Lot de conditionnement ID ${itemUsed.conditionnementId} non trouvé pour la déduction.`;
                 return { success: false, updatedConditionnements: currentConds, errorMessage };
            }
        }
    } else { // Re-credit (factor === -1)
        items.forEach(itemUsed => {
            const idx = clonedConds.findIndex(c => c.id === itemUsed.conditionnementId);
            if (idx > -1) {
                clonedConds[idx].quantiteRestante = (clonedConds[idx].quantiteRestante || 0) + itemUsed.quantite;
            }
        });
    }
    return { success: true, updatedConditionnements: clonedConds };
};


const _tryApplyComposantStockChanges = (
    items: ComposantLotFabrication[] | undefined,
    factor: 1 | -1,
    allData: AllData
): {
    success: boolean;
    updatedData?: Partial<AllData>;
    errorMessage?: string;
} => {
    if (!items || items.length === 0) return { success: true, updatedData: {} };

    let clonedIngrs = allData.ingredientsAchetesData.map(i => ({ ...i }));
    let clonedRecs = allData.recoltesData.map(r => ({ ...r }));
    let clonedEtaps = allData.etapesTransformationData.map(e => ({ ...e }));
    let errorMessage = '';

    if (factor === 1) { // Deduction
        for (const comp of items) {
            const qtyToDeduct = comp.quantitePrelevee;
            if (comp.typeComposant === 'IngredientAchete') {
                const idx = clonedIngrs.findIndex(ing => ing.id === comp.lotUtiliseId);
                if (idx > -1) {
                    if ((clonedIngrs[idx].quantiteRestante || 0) < qtyToDeduct) {
                        errorMessage = `Stock ingrédient ${clonedIngrs[idx].nom} (Lot: ${clonedIngrs[idx].numeroLotFournisseur || clonedIngrs[idx].id.substring(0,4)}) insuffisant. Requis: ${qtyToDeduct}, Disponible: ${clonedIngrs[idx].quantiteRestante || 0}.`;
                        return { success: false, errorMessage };
                    }
                    clonedIngrs[idx].quantiteRestante = (clonedIngrs[idx].quantiteRestante || 0) - qtyToDeduct;
                } else {
                    errorMessage = `Ingrédient Acheté lot ID ${comp.lotUtiliseId} non trouvé pour déduction.`;
                    return { success: false, errorMessage };
                }
            } else { // PlanteCultivee (Récolte ou ÉtapeTransformation)
                const recIdx = clonedRecs.findIndex(r => r.id === comp.lotUtiliseId);
                if (recIdx > -1) {
                    if ((clonedRecs[recIdx].poidsApresSechage || 0) < qtyToDeduct) {
                        const culture = allData.culturesData.find(c => c.id === clonedRecs[recIdx].cultureId);
                        errorMessage = `Stock récolte ${culture?.nomPlante || 'N/A'} (Lot: ${clonedRecs[recIdx].lotNumero}) insuffisant. Requis: ${qtyToDeduct}, Disponible: ${clonedRecs[recIdx].poidsApresSechage || 0}.`;
                        return { success: false, errorMessage };
                    }
                    clonedRecs[recIdx].poidsApresSechage = (clonedRecs[recIdx].poidsApresSechage || 0) - qtyToDeduct;
                } else {
                    const etIdx = clonedEtaps.findIndex(et => et.lotSortantId === comp.lotUtiliseId);
                    if (etIdx > -1) {
                        if ((clonedEtaps[etIdx].quantiteSortante || 0) < qtyToDeduct) {
                             errorMessage = `Stock étape transformation ${clonedEtaps[etIdx].matiereSortanteDescription} (Lot: ${clonedEtaps[etIdx].lotSortantId}) insuffisant. Requis: ${qtyToDeduct}, Disponible: ${clonedEtaps[etIdx].quantiteSortante || 0}.`;
                             return { success: false, errorMessage };
                        }
                        clonedEtaps[etIdx].quantiteSortante = (clonedEtaps[etIdx].quantiteSortante || 0) - qtyToDeduct;
                    } else {
                        errorMessage = `Composant "Plante Cultivée" lot ID ${comp.lotUtiliseId} (Récolte/Étape Transfo) non trouvé pour déduction.`;
                        return { success: false, errorMessage };
                    }
                }
            }
        }
    } else { // Re-credit
        items.forEach(comp => {
            const qtyToRecredit = comp.quantitePrelevee;
            if (comp.typeComposant === 'IngredientAchete') {
                const idx = clonedIngrs.findIndex(ing => ing.id === comp.lotUtiliseId);
                if (idx > -1) clonedIngrs[idx].quantiteRestante = (clonedIngrs[idx].quantiteRestante || 0) + qtyToRecredit;
            } else {
                const recIdx = clonedRecs.findIndex(r => r.id === comp.lotUtiliseId);
                if (recIdx > -1) clonedRecs[recIdx].poidsApresSechage = (clonedRecs[recIdx].poidsApresSechage || 0) + qtyToRecredit;
                else {
                    const etIdx = clonedEtaps.findIndex(et => et.lotSortantId === comp.lotUtiliseId);
                    if (etIdx > -1) clonedEtaps[etIdx].quantiteSortante = (clonedEtaps[etIdx].quantiteSortante || 0) + qtyToRecredit;
                }
            }
        });
    }
    return { success: true, updatedData: { ingredientsAchetesData: clonedIngrs, recoltesData: clonedRecs, etapesTransformationData: clonedEtaps } };
};

const _tryApplyIntrantStockChanges = (
    items: CoutIntrantUtilise[] | undefined,
    factor: 1 | -1,
    currentIntrants: IntrantAgricole[]
): { success: boolean; updatedIntrants: IntrantAgricole[]; errorMessage?: string } => {
    if (!items) return { success: true, updatedIntrants: [...currentIntrants] };

    let clonedIntrants = currentIntrants.map(i => ({ ...i }));
    let errorMessage = '';

    if (factor === 1) { // Deduction
        for (const itemUsed of items) {
            const idx = clonedIntrants.findIndex(i => i.id === itemUsed.intrantId);
            if (idx > -1) {
                if ((clonedIntrants[idx].quantiteRestante || 0) < itemUsed.quantiteUtilisee) {
                    errorMessage = `Stock insuffisant pour l'intrant ${clonedIntrants[idx].nom}. Requis: ${itemUsed.quantiteUtilisee}, Disponible: ${clonedIntrants[idx].quantiteRestante || 0}`;
                    return { success: false, updatedIntrants: currentIntrants, errorMessage };
                }
                clonedIntrants[idx].quantiteRestante = (clonedIntrants[idx].quantiteRestante || 0) - itemUsed.quantiteUtilisee;
            } else {
                 errorMessage = `Lot d'intrant agricole ID ${itemUsed.intrantId} non trouvé pour la déduction.`;
                 return { success: false, updatedIntrants: currentIntrants, errorMessage };
            }
        }
    } else { // Re-credit
        items.forEach(itemUsed => {
            const idx = clonedIntrants.findIndex(i => i.id === itemUsed.intrantId);
            if (idx > -1) {
                clonedIntrants[idx].quantiteRestante = (clonedIntrants[idx].quantiteRestante || 0) + itemUsed.quantiteUtilisee;
            }
        });
    }
    return { success: true, updatedIntrants: clonedIntrants };
};


// --- Public API Functions ---

type StockManagerResult = { success: boolean, updatedData?: Partial<AllData>, errorMessage?: string };

export const manageLotFabricationStockOnSave = (oldLot: LotFabrication | null, newLot: LotFabrication, allData: AllData): StockManagerResult => {
    let tempConds = [...allData.conditionnementsData];
    let tempCompsData: Partial<AllData> = {
        ingredientsAchetesData: [...allData.ingredientsAchetesData],
        recoltesData: [...allData.recoltesData],
        etapesTransformationData: [...allData.etapesTransformationData],
    };

    const oldStatusDeducted = oldLot && LOT_FABRICATION_STOCK_DEDUCTING_STATUSES.includes(oldLot.statut);
    const newStatusDeducts = LOT_FABRICATION_STOCK_DEDUCTING_STATUSES.includes(newLot.statut);

    // Re-credit stock from old version if it was deducted
    if (oldStatusDeducted) {
        const condRecredit = _tryApplyConditionnementStockChanges(oldLot.conditionnementsUtilises, -1, tempConds);
        tempConds = condRecredit.updatedConditionnements;

        const compRecredit = _tryApplyComposantStockChanges(oldLot.composantsUtilises, -1, { ...allData, ...tempCompsData, conditionnementsData: tempConds });
        tempCompsData = compRecredit.updatedData || tempCompsData;
    }

    // Deduct stock for new version if needed
    if (newStatusDeducts) {
        const condDeduct = _tryApplyConditionnementStockChanges(newLot.conditionnementsUtilises, 1, tempConds);
        if (!condDeduct.success) {
            return { success: false, errorMessage: condDeduct.errorMessage };
        }
        tempConds = condDeduct.updatedConditionnements;

        const compDeduct = _tryApplyComposantStockChanges(newLot.composantsUtilises, 1, { ...allData, ...tempCompsData, conditionnementsData: tempConds });
        if (!compDeduct.success) {
            return { success: false, errorMessage: compDeduct.errorMessage };
        }
        tempCompsData = compDeduct.updatedData || tempCompsData;
    }

    return {
        success: true,
        updatedData: {
            ...tempCompsData,
            conditionnementsData: tempConds
        }
    };
};

export const manageLotFabricationStockOnDelete = (lotToDelete: LotFabrication, allData: AllData): StockManagerResult => {
    if (lotToDelete.quantiteVendue > 0) {
        return { success: false, errorMessage: "Suppression impossible: ce lot a des ventes enregistrées." };
    }
    
    if (LOT_FABRICATION_STOCK_DEDUCTING_STATUSES.includes(lotToDelete.statut)) {
        let tempConds = _tryApplyConditionnementStockChanges(lotToDelete.conditionnementsUtilises, -1, allData.conditionnementsData).updatedConditionnements;
        let tempComps = _tryApplyComposantStockChanges(lotToDelete.composantsUtilises, -1, allData);

        return {
            success: true,
            updatedData: {
                ...tempComps.updatedData,
                conditionnementsData: tempConds,
            }
        };
    }
    
    return { success: true, updatedData: {} };
};

export const manageRecolteStockOnSave = (oldRecolte: Recolte | null, newRecolte: Recolte, allData: AllData): StockManagerResult => {
    let tempIntrants = [...allData.intrantsAgricolesData];

    const oldStatusConsumedStock = oldRecolte && RECOLTE_STOCK_DEDUCTING_STATUSES.includes(oldRecolte.statut);
    const newStatusConsumesStock = RECOLTE_STOCK_DEDUCTING_STATUSES.includes(newRecolte.statut);

    if (oldStatusConsumedStock) {
        const result = _tryApplyIntrantStockChanges(oldRecolte.intrantsUtilises, -1, tempIntrants);
        tempIntrants = result.updatedIntrants;
    }

    if (newStatusConsumesStock) {
        const result = _tryApplyIntrantStockChanges(newRecolte.intrantsUtilises, 1, tempIntrants);
        if (!result.success) {
            return { success: false, errorMessage: result.errorMessage };
        }
        tempIntrants = result.updatedIntrants;
    }
    
    return { success: true, updatedData: { intrantsAgricolesData: tempIntrants } };
};

export const manageRecolteStockOnDelete = (recolteToDelete: Recolte, allData: AllData): StockManagerResult => {
    if (RECOLTE_STOCK_DEDUCTING_STATUSES.includes(recolteToDelete.statut)) {
        const result = _tryApplyIntrantStockChanges(recolteToDelete.intrantsUtilises, -1, allData.intrantsAgricolesData);
        return { success: true, updatedData: { intrantsAgricolesData: result.updatedIntrants } };
    }
    return { success: true, updatedData: {} };
};


export const manageVenteStockOnSave = (oldVente: Vente | null, newVente: Vente, lots: LotFabrication[]): { success: boolean; updatedLots?: LotFabrication[]; errorMessage?: string } => {
    let tempLots = lots.map(l => ({ ...l }));
    const lotFabAssocie = tempLots.find(l => l.id === newVente.lotFabricationId);
    
    if (!lotFabAssocie) {
        return { success: false, errorMessage: "Lot de fabrication associé non trouvé." };
    }

    // Temporarily re-credit stock from the old sale if it exists
    if (oldVente) {
        const oldLotIndex = tempLots.findIndex(l => l.id === oldVente.lotFabricationId);
        if (oldLotIndex > -1) {
            tempLots[oldLotIndex].quantiteVendue = (tempLots[oldLotIndex].quantiteVendue || 0) - oldVente.quantiteVendue;
        }
    }

    // Now check stock availability on the (potentially) re-credited lot
    const lotForCheckIndex = tempLots.findIndex(l => l.id === newVente.lotFabricationId);
    const lotForCheck = tempLots[lotForCheckIndex];
    let stockActuelLot = (lotForCheck.quantiteFabriquee || 0) - (lotForCheck.quantiteVendue || 0);

    if (newVente.quantiteVendue > stockActuelLot) {
        return { success: false, errorMessage: `Quantité vendue (${newVente.quantiteVendue}) dépasse le stock disponible (${stockActuelLot}) pour le lot ${lotForCheck.lotNumeroProduitFini}.`};
    }

    // If check passes, apply the new sale quantity deduction
    tempLots[lotForCheckIndex].quantiteVendue = (tempLots[lotForCheckIndex].quantiteVendue || 0) + newVente.quantiteVendue;
    
    return { success: true, updatedLots: tempLots };
};

export const manageVenteStockOnDelete = (venteToDelete: Vente, lots: LotFabrication[]): { success: boolean, updatedLots: LotFabrication[] } => {
    const updatedLots = lots.map(l =>
        l.id === venteToDelete.lotFabricationId
            ? { ...l, quantiteVendue: Math.max(0, (l.quantiteVendue || 0) - venteToDelete.quantiteVendue) }
            : l
    );
    return { success: true, updatedLots };
};
