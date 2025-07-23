
import { AllData, IngredientAchete, Conditionnement, ProduitFiniBase, LotFabrication, Recolte, Vente, Culture } from '../types';
import { formatDateForInput, calculateVenteDetails, calculateLotFabricationCost, calculateRecolteCost, getAllInventoryAlerts, isDateApproaching } from './helpers';

// Ensure jsPDF and autoTable are loaded (typically via index.html)
// And extend the window object if necessary, or cast:
// const { jsPDF } = window.jspdf;
// const autoTable = window.jspdf.autoTable;

const BRAND_DARK_COLOR_HEX = '#064e3b'; // emerald-900
const BRAND_PRIMARY_COLOR_HEX = '#059669'; // emerald-600
const BRAND_SECONDARY_COLOR_HEX = '#f59e0b'; // amber-500
const TEXT_COLOR_DARK_HEX = '#1f2937'; // gray-800
const TEXT_COLOR_MEDIUM_HEX = '#6b7280'; // gray-500
const TEXT_COLOR_LIGHT_HEX = '#f9fafb'; // gray-50

const hexToRgb = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

const BRAND_DARK_RGB = hexToRgb(BRAND_DARK_COLOR_HEX);
const BRAND_PRIMARY_RGB = hexToRgb(BRAND_PRIMARY_COLOR_HEX);
const TEXT_DARK_RGB = hexToRgb(TEXT_COLOR_DARK_HEX);
const TEXT_MEDIUM_RGB = hexToRgb(TEXT_COLOR_MEDIUM_HEX);


const addFooter = (doc: any, pageNumber: number, totalPages: number) => {
  doc.setFontSize(8);
  doc.setTextColor(TEXT_MEDIUM_RGB[0], TEXT_MEDIUM_RGB[1], TEXT_MEDIUM_RGB[2]);
  const pageText = `Page ${pageNumber} sur ${totalPages}`;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(pageText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
};

const addReportHeader = (doc: any, title: string, subTitle?: string) => {
    doc.setFontSize(18);
    doc.setTextColor(BRAND_DARK_RGB[0], BRAND_DARK_RGB[1], BRAND_DARK_RGB[2]);
    doc.text(title, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(TEXT_MEDIUM_RGB[0], TEXT_MEDIUM_RGB[1], TEXT_MEDIUM_RGB[2]);
    doc.text(`Herboristerie La Fée des Bois`, 14, 30);
    if (subTitle) {
        doc.text(subTitle, 14, 36);
    }
    doc.text(`Généré le: ${formatDateForInput(new Date().toISOString())}`, doc.internal.pageSize.getWidth() - 14, 30, { align: 'right'});
    return subTitle ? 42 : 36; // Return Y position for next content
};


export const generateSalesPdfReport = async (allData: AllData, startDate: string, endDate: string): Promise<void> => {
  const { jsPDF } = window.jspdf;
  const autoTable = window.jspdf.autoTable;

  if (!jsPDF || !autoTable) {
    console.error("jsPDF or jsPDF-AutoTable is not loaded.");
    alert("Erreur: La librairie PDF n'est pas chargée.");
    return;
  }

  const doc = new jsPDF();
  let yPos = addReportHeader(doc, "Rapport des Ventes", `Période: du ${formatDateForInput(startDate)} au ${formatDateForInput(endDate)}`);

  const filteredVentes = allData.ventesData.filter(vente => {
    const venteDate = new Date(vente.dateVente);
    return venteDate >= new Date(startDate) && venteDate <= new Date(endDate);
  });

  if (filteredVentes.length === 0) {
    alert("Aucune vente trouvée pour la période sélectionnée.");
    return;
  }

  let totalRevenue = 0;
  let totalCOGS = 0;
  filteredVentes.forEach(vente => {
    totalRevenue += vente.prixVenteTotal || 0;
    const lotFab = allData.lotsFabricationData.find(l => l.id === vente.lotFabricationId);
    const { coutRevientVendu } = calculateVenteDetails(vente, lotFab);
    totalCOGS += coutRevientVendu;
  });
  const totalMargin = totalRevenue - totalCOGS;
  const averageMarginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  doc.setFontSize(12);
  doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
  yPos += 8; // Add some margin
  doc.text("Résumé des Ventes", 14, yPos);
  yPos += 5;
  
  autoTable(doc, {
    startY: yPos,
    head: [['Métrique', 'Valeur']],
    body: [
      ['Nombre de Ventes', filteredVentes.length.toString()],
      ['Revenu Total', `${totalRevenue.toFixed(2)} CAD`],
      ['Coût Total des Marchandises Vendues (CMV)', `${totalCOGS.toFixed(2)} CAD`],
      ['Marge Brute Totale', `${totalMargin.toFixed(2)} CAD`],
      ['Marge Brute Moyenne (%)', `${averageMarginPercentage.toFixed(1)} %`],
    ],
    theme: 'striped',
    headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX }, 
    styles: { fontSize: 10, cellPadding: 2, textColor: TEXT_DARK_RGB },
    columnStyles: { 0: { cellWidth: 60 } },
  });
  yPos = (doc as any).lastAutoTable.finalY;

  const tableData = filteredVentes.map(vente => {
    const lotFab = allData.lotsFabricationData.find(l => l.id === vente.lotFabricationId);
    const { coutRevientVendu, margeBruteAbsolue } = calculateVenteDetails(vente, lotFab);
    return [
      formatDateForInput(vente.dateVente),
      vente.nomProduitVendu || 'N/A',
      vente.numeroLotVendu || 'N/A',
      vente.quantiteVendue.toString(),
      (vente.prixVenteUnitaire || 0).toFixed(2),
      (vente.prixVenteTotal || 0).toFixed(2),
      coutRevientVendu.toFixed(2),
      margeBruteAbsolue.toFixed(2),
    ];
  });

  if (yPos > doc.internal.pageSize.getHeight() - 60) { 
    doc.addPage(); yPos = 10; 
  } else { yPos += 10; }

  doc.setFontSize(12);
  doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
  doc.text("Détail des Ventes", 14, yPos);
  yPos += 5;

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Produit', 'Lot PF', 'Qté', 'Prix Unit.', 'Total Vente', 'CMV', 'Marge']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX },
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', textColor: TEXT_DARK_RGB },
    columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 45 }, 2: { cellWidth: 20 }, 3: { cellWidth: 10, halign: 'right' },
        4: { cellWidth: 18, halign: 'right' }, 5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' },
    },
    didDrawPage: (data: any) => { addFooter(doc, data.pageNumber, (doc.internal as any).getNumberOfPages()); }
  });
  
   if ((doc.internal as any).getNumberOfPages() === 1 && (doc as any).lastAutoTable.finalY < doc.internal.pageSize.getHeight() - 20) {
       addFooter(doc, 1, 1);
   }

  const safeStartDate = startDate.replace(/-/g, '');
  const safeEndDate = endDate.replace(/-/g, '');
  doc.save(`Rapport_Ventes_${safeStartDate}_${safeEndDate}.pdf`);
};


export const generateIngredientStockStatusPdf = async (allData: AllData): Promise<void> => {
  const { jsPDF } = window.jspdf;
  const autoTable = window.jspdf.autoTable;
  const doc = new jsPDF();
  let yPos = addReportHeader(doc, "État des Stocks d'Ingrédients Achetés");

  const tableData = allData.ingredientsAchetesData.map(ing => [
    ing.nom,
    ing.numeroLotFournisseur || 'N/A',
    ing.quantiteRestante,
    ing.unite,
    (ing.coutUnitaire || 0).toFixed(3),
    ing.datePeremption ? formatDateForInput(ing.datePeremption) : 'N/A',
    ing.fournisseur || 'N/A',
  ]);
  
  yPos += 8;
  autoTable(doc, {
    startY: yPos,
    head: [['Nom', 'Lot Fourn.', 'Qté Rest.', 'Unité', 'Coût Unit.', 'Péremption', 'Fournisseur']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX },
    styles: { fontSize: 8, textColor: TEXT_DARK_RGB },
    didDrawPage: (data: any) => { addFooter(doc, data.pageNumber, (doc.internal as any).getNumberOfPages()); }
  });
   if ((doc.internal as any).getNumberOfPages() === 1 && (doc as any).lastAutoTable.finalY < doc.internal.pageSize.getHeight() - 20) { addFooter(doc, 1, 1); }
  doc.save("Rapport_Stock_Ingredients.pdf");
};

export const generatePackagingStockStatusPdf = async (allData: AllData): Promise<void> => {
  const { jsPDF } = window.jspdf;
  const autoTable = window.jspdf.autoTable;
  const doc = new jsPDF();
  let yPos = addReportHeader(doc, "État des Stocks de Conditionnements");

  const tableData = allData.conditionnementsData.map(cond => [
    cond.nom,
    cond.referenceFournisseur || 'N/A',
    cond.quantiteRestante,
    (cond.coutUnitaire || 0).toFixed(2),
    cond.fournisseur || 'N/A',
    cond.dateAchat ? formatDateForInput(cond.dateAchat) : 'N/A'
  ]);

  yPos += 8;
  autoTable(doc, {
    startY: yPos,
    head: [['Nom', 'Lot Réf.', 'Qté Restante', 'Coût Unit.', 'Fournisseur', 'Date Achat']],
    body: tableData,
    theme: 'grid',
     headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX },
    styles: { fontSize: 9, textColor: TEXT_DARK_RGB },
    didDrawPage: (data: any) => { addFooter(doc, data.pageNumber, (doc.internal as any).getNumberOfPages()); }
  });
  if ((doc.internal as any).getNumberOfPages() === 1 && (doc as any).lastAutoTable.finalY < doc.internal.pageSize.getHeight() - 20) { addFooter(doc, 1, 1); }
  doc.save("Rapport_Stock_Conditionnements.pdf");
};

export const generateFinishedGoodsStockStatusPdf = async (allData: AllData): Promise<void> => {
    const { jsPDF } = window.jspdf;
    const autoTable = window.jspdf.autoTable;
    const doc = new jsPDF();
    let yPos = addReportHeader(doc, "État des Stocks de Produits Finis");
    yPos += 8;

    allData.produitsFiniBaseData.forEach(pfb => {
        if (yPos > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); yPos = 20; }
        doc.setFontSize(12);
        doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
        doc.text(`${pfb.nom} (Seuil: ${pfb.seuilReapprovisionnementPF || 'N/A'} ${pfb.uniteVente || ''})`, 14, yPos);
        yPos += 6;

        const lotsAssocies = allData.lotsFabricationData.filter(lot => {
            const recette = allData.recettesData.find(r => r.id === lot.recetteId);
            return recette?.produitFiniBaseId === pfb.id && lot.statut === 'Commercialisable';
        });

        if (lotsAssocies.length > 0) {
            const tableData = lotsAssocies.map(lot => {
                const stockRestant = (lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0);
                return [
                    lot.lotNumeroProduitFini,
                    stockRestant,
                    lot.uniteFabriquee,
                    lot.dluo ? formatDateForInput(lot.dluo) : 'N/A',
                    (lot.prixRevientUnitaireEstime || 0).toFixed(2),
                ];
            });
            autoTable(doc, {
                startY: yPos,
                head: [['Lot PF', 'Qté Restante', 'Unité', 'DLUO', 'Prix Revient Unit.']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX },
                styles: { fontSize: 8, textColor: TEXT_DARK_RGB },
                didDrawPage: (data: any) => { addFooter(doc, data.pageNumber, (doc.internal as any).getNumberOfPages()); }
            });
            yPos = (doc as any).lastAutoTable.finalY + 7;
        } else {
            doc.setFontSize(9);
            doc.setTextColor(TEXT_MEDIUM_RGB[0], TEXT_MEDIUM_RGB[1], TEXT_MEDIUM_RGB[2]);
            doc.text("Aucun lot commercialisable en stock.", 14, yPos);
            yPos += 7;
        }
    });
    if ((doc.internal as any).getNumberOfPages() === 1 && yPos < doc.internal.pageSize.getHeight() - 20 && !allData.produitsFiniBaseData.length) { 
      addFooter(doc, 1, 1); 
    } else if ((doc.internal as any).getNumberOfPages() > 0 && (doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY < doc.internal.pageSize.getHeight() -20) {
      addFooter(doc, (doc.internal as any).getNumberOfPages(), (doc.internal as any).getNumberOfPages());
    } else if ((doc.internal as any).getNumberOfPages() > 0 && !(doc as any).lastAutoTable && yPos < doc.internal.pageSize.getHeight() - 20) {
      addFooter(doc, (doc.internal as any).getNumberOfPages(), (doc.internal as any).getNumberOfPages());
    }


    doc.save("Rapport_Stock_Produits_Finis.pdf");
};

export const generateProductionLotsPdf = async (allData: AllData, startDate: string, endDate: string): Promise<void> => {
    const { jsPDF } = window.jspdf;
    const autoTable = window.jspdf.autoTable;
    const doc = new jsPDF();
    let yPos = addReportHeader(doc, "Lots de Fabrication", `Période: du ${formatDateForInput(startDate)} au ${formatDateForInput(endDate)}`);

    const filteredLots = allData.lotsFabricationData.filter(lot => {
        const lotDate = new Date(lot.dateFabrication);
        return lotDate >= new Date(startDate) && lotDate <= new Date(endDate);
    });
     if (filteredLots.length === 0) { alert("Aucun lot de fabrication trouvé pour la période."); return; }

    const tableData = filteredLots.map(lot => [
        formatDateForInput(lot.dateFabrication),
        lot.nomProduitFini,
        lot.lotNumeroProduitFini,
        lot.quantiteFabriquee,
        lot.uniteFabriquee,
        (lot.prixRevientUnitaireEstime || 0).toFixed(2),
        lot.statut,
    ]);
    
    yPos += 8;
    autoTable(doc, {
        startY: yPos,
        head: [['Date Fab.', 'Produit', 'Lot PF', 'Qté Fab.', 'Unité', 'Coût Revient Unit.', 'Statut']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX },
        styles: { fontSize: 8, textColor: TEXT_DARK_RGB },
        didDrawPage: (data: any) => { addFooter(doc, data.pageNumber, (doc.internal as any).getNumberOfPages()); }
    });
    if ((doc.internal as any).getNumberOfPages() === 1 && (doc as any).lastAutoTable.finalY < doc.internal.pageSize.getHeight() - 20) { addFooter(doc, 1, 1); }
    const safeStartDate = startDate.replace(/-/g, '');
    const safeEndDate = endDate.replace(/-/g, '');
    doc.save(`Rapport_Lots_Fabrication_${safeStartDate}_${safeEndDate}.pdf`);
};

export const generateHarvestsPdf = async (allData: AllData, startDate: string, endDate: string): Promise<void> => {
    const { jsPDF } = window.jspdf;
    const autoTable = window.jspdf.autoTable;
    const doc = new jsPDF();
    let yPos = addReportHeader(doc, "Rapport des Récoltes", `Période: du ${formatDateForInput(startDate)} au ${formatDateForInput(endDate)}`);

    const filteredHarvests = allData.recoltesData.filter(rec => {
        const recDate = new Date(rec.dateRecolte);
        return recDate >= new Date(startDate) && recDate <= new Date(endDate);
    });
    if (filteredHarvests.length === 0) { alert("Aucune récolte trouvée pour la période."); return; }

    const tableData = filteredHarvests.map(rec => {
        const costData = calculateRecolteCost(rec, allData);
        const culture = allData.culturesData.find(c => c.id === rec.cultureId);
        return [
            formatDateForInput(rec.dateRecolte),
            culture?.nomPlante || 'N/A',
            rec.lotNumero,
            `${rec.poidsApresSechage || 0} ${rec.unitePoids || ''}`,
            costData.coutProductionTotalEstime.toFixed(2),
            costData.coutUnitaireApresSechageEstime > 0 ? costData.coutUnitaireApresSechageEstime.toFixed(3) : 'N/A',
            rec.statut,
        ];
    });
    yPos += 8;
    autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Plante', 'Lot Récolte', 'Poids Sec', 'Coût Prod. Total', 'Coût Unit. Sec', 'Statut']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX },
        styles: { fontSize: 8, textColor: TEXT_DARK_RGB },
        columnStyles: { 
          3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } 
        },
        didDrawPage: (data: any) => { addFooter(doc, data.pageNumber, (doc.internal as any).getNumberOfPages()); }
    });
    if ((doc.internal as any).getNumberOfPages() === 1 && (doc as any).lastAutoTable.finalY < doc.internal.pageSize.getHeight() - 20) { addFooter(doc, 1, 1); }
    const safeStartDate = startDate.replace(/-/g, '');
    const safeEndDate = endDate.replace(/-/g, '');
    doc.save(`Rapport_Recoltes_${safeStartDate}_${safeEndDate}.pdf`);
};

export const generateTransformationsPdf = async (allData: AllData, startDate: string, endDate: string): Promise<void> => {
  // Placeholder for Transformations report
  alert("Le rapport des étapes de transformation n'est pas encore implémenté.");
};

export const generateTraceabilityReportPdf = async (allData: AllData, lotFabricationId: string): Promise<void> => {
    const { jsPDF } = window.jspdf;
    const autoTable = window.jspdf.autoTable;

    const lotFab = allData.lotsFabricationData.find(l => l.id === lotFabricationId);
    if (!lotFab) {
        alert("Lot de fabrication non trouvé.");
        return;
    }

    const doc = new jsPDF();
    let yPos = addReportHeader(doc, "Rapport de Traçabilité Complet", `Lot de Produit Fini: ${lotFab.lotNumeroProduitFini}`);

    const addSectionTitle = (title: string, y: number) => {
        if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
        doc.text(title, 14, y);
        return y + 6;
    };

    // 1. Finished Good Lot Info
    yPos = addSectionTitle("1. Lot de Produit Fini", yPos);
    autoTable(doc, {
        startY: yPos,
        body: [
            ['Nom Produit', lotFab.nomProduitFini],
            ['N° Lot Produit Fini', lotFab.lotNumeroProduitFini],
            ['Date Fabrication', formatDateForInput(lotFab.dateFabrication)],
            ['Quantité Fabriquée', `${lotFab.quantiteFabriquee} ${lotFab.uniteFabriquee}`],
            ['Statut', lotFab.statut],
            ['DLUO', lotFab.dluo ? formatDateForInput(lotFab.dluo) : 'N/A'],
        ],
        theme: 'plain', styles: { fontSize: 9 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;

    // 2. Raw Materials Used
    yPos = addSectionTitle("2. Matières Premières Utilisées", yPos);
    const composantsData = lotFab.composantsUtilises.map(comp => {
        let sourceDetails = `Lot ID: ${comp.lotUtiliseId}`;
        const ing = allData.ingredientsAchetesData.find(i => i.id === comp.lotUtiliseId);
        if (ing) sourceDetails = `Ing. Acheté: Lot Fourn. ${ing.numeroLotFournisseur || ing.id.substring(0,4)}`;

        const rec = allData.recoltesData.find(r => r.id === comp.lotUtiliseId);
        if (rec) {
             const culture = allData.culturesData.find(c => c.id === rec.cultureId);
             sourceDetails = `Récolte: ${culture?.nomPlante || 'N/A'} (Lot ${rec.lotNumero})`;
        }

        const etape = allData.etapesTransformationData.find(e => e.id === comp.lotUtiliseId);
        if (etape) sourceDetails = `Transformation: ${etape.matiereSortanteDescription} (Lot ${etape.lotSortantId})`;

        return [comp.nomComposant, `${comp.quantitePrelevee} ${comp.unitePrelevee}`, sourceDetails];
    });

    autoTable(doc, {
        startY: yPos,
        head: [['Composant (Recette)', 'Quantité Prélevée', 'Source du Lot']],
        body: composantsData,
        theme: 'striped', headStyles: { fillColor: BRAND_DARK_RGB, textColor: TEXT_COLOR_LIGHT_HEX }, styles: { fontSize: 8, cellPadding: 2 }
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
    
    // 3. Drill-down into Harvests
    const recoltesUtiliseesIds = lotFab.composantsUtilises
        .filter(c => c.typeComposant === 'PlanteCultivee')
        .map(c => allData.recoltesData.find(r => r.id === c.lotUtiliseId)?.id)
        .filter((id): id is string => !!id);
    const recoltesUtilisees = allData.recoltesData.filter(r => recoltesUtiliseesIds.includes(r.id));
    
    if (recoltesUtilisees.length > 0) {
        yPos = addSectionTitle("3. Détail des Lots de Récolte Utilisés", yPos);
        recoltesUtilisees.forEach(rec => {
            const culture = allData.culturesData.find(c => c.id === rec.cultureId);
            if (!culture) return;
            if (yPos > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); yPos = 20; }
            
            doc.setFontSize(10);
            doc.setTextColor(TEXT_DARK_RGB[0], TEXT_DARK_RGB[1], TEXT_DARK_RGB[2]);
            doc.text(`Lot Récolte: ${rec.lotNumero} (Plante: ${culture.nomPlante})`, 14, yPos);
            yPos += 5;
            
            autoTable(doc, {
                startY: yPos,
                body: [
                    ['Date Récolte', formatDateForInput(rec.dateRecolte)],
                    ['Parcelle de Culture', culture.parcelle],
                    ['Date Plantation', formatDateForInput(culture.datePlantation)],
                    ['Intrants sur Culture', culture.intrantsUtilises?.length || 0],
                ],
                theme: 'plain', styles: { fontSize: 8 }, tableWidth: 'auto'
            });
            yPos = (doc as any).lastAutoTable.finalY + 5;
        });
    }

    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(doc, i, totalPages);
    }

    doc.save(`Rapport_Tracabilite_${lotFab.lotNumeroProduitFini}.pdf`);
};

export const generateGeneralActivityOverviewPdf = async (allData: AllData): Promise<void> => {
  const { jsPDF } = window.jspdf;
  const autoTable = window.jspdf.autoTable;
  const doc = new jsPDF();
  let yPos = addReportHeader(doc, "Vue d'Ensemble de l'Activité");
  yPos += 8;

  doc.setFontSize(12);
  doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
  
  // Section Indicateurs Clés
  doc.text("Objectifs Manuels Récents", 14, yPos); yPos +=6;
  const kpiData = allData.indicateursManuelsData
    .sort((a,b) => new Date(b.dateEnregistrement).getTime() - new Date(a.dateEnregistrement).getTime())
    .slice(0, 5)
    .map(kpi => [kpi.nom, `${kpi.valeurActuelle} ${kpi.unite}`, formatDateForInput(kpi.dateEnregistrement)]);
    
  if (kpiData.length > 0) {
    autoTable(doc, { startY: yPos, head: [['Nom Objectif', 'Valeur Actuelle', 'Date']], body: kpiData, theme: 'striped', headStyles: {fillColor: BRAND_DARK_RGB} });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9); doc.setTextColor(TEXT_MEDIUM_RGB[0], TEXT_MEDIUM_RGB[1], TEXT_MEDIUM_RGB[2]);
    doc.text("Aucun objectif manuel enregistré.", 14, yPos); yPos +=6;
  }
  if (yPos > 250) { doc.addPage(); yPos = 20; }
  
  // Section Alertes
  doc.setFontSize(12); doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
  doc.text("Alertes Actives", 14, yPos); yPos +=6;
  const alerts = getAllInventoryAlerts(allData).slice(0, 10); // Show top 10 alerts
  const alertData = alerts.map(alert => [alert.itemName, alert.message, alert.severity]);
   if (alertData.length > 0) {
    autoTable(doc, { startY: yPos, head: [['Item', 'Message', 'Sévérité']], body: alertData, theme: 'striped', headStyles: {fillColor: BRAND_DARK_RGB}, styles: {fontSize: 8}, columnStyles: {0: {cellWidth: 70}, 1: {cellWidth: 'auto'}}});
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9); doc.setTextColor(TEXT_MEDIUM_RGB[0], TEXT_MEDIUM_RGB[1], TEXT_MEDIUM_RGB[2]);
    doc.text("Aucune alerte d'inventaire active.", 14, yPos); yPos +=6;
  }
  if (yPos > 250) { doc.addPage(); yPos = 20; }

  // Résumé Financier (dernières 5 ventes)
  doc.setFontSize(12); doc.setTextColor(BRAND_PRIMARY_RGB[0], BRAND_PRIMARY_RGB[1], BRAND_PRIMARY_RGB[2]);
  doc.text("Dernières Ventes (max. 5)", 14, yPos); yPos +=6;
  const last5Ventes = allData.ventesData.sort((a,b) => new Date(b.dateVente).getTime() - new Date(a.dateVente).getTime()).slice(0,5);
  const ventesSummary = last5Ventes.map(v => {
      const lot = allData.lotsFabricationData.find(l => l.id === v.lotFabricationId);
      const {margeBruteAbsolue} = calculateVenteDetails(v, lot);
      return [formatDateForInput(v.dateVente), v.nomProduitVendu, (v.prixVenteTotal || 0).toFixed(2), margeBruteAbsolue.toFixed(2)];
  });
  if (ventesSummary.length > 0) {
    autoTable(doc, { startY: yPos, head: [['Date', 'Produit', 'Total Vente', 'Marge Brute']], body: ventesSummary, theme: 'striped', headStyles: {fillColor: BRAND_DARK_RGB}, styles: {fontSize: 8}});
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9); doc.setTextColor(TEXT_MEDIUM_RGB[0], TEXT_MEDIUM_RGB[1], TEXT_MEDIUM_RGB[2]);
    doc.text("Aucune vente enregistrée.", 14, yPos); yPos +=6;
  }

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  doc.save("Rapport_Activite_Generale.pdf");
};
