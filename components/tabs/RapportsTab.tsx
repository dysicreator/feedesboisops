

import React, { useState, useCallback, useMemo, useContext } from 'react';
import { Vente, LotFabrication, AllData } from '../../types';
import { DataContext } from '../DataContext';
import { formatDateForInput } from '../../utils/helpers';
import { 
    generateSalesPdfReport, 
    generateIngredientStockStatusPdf,
    generatePackagingStockStatusPdf,
    generateFinishedGoodsStockStatusPdf,
    generateProductionLotsPdf,
    generateHarvestsPdf,
    generateTransformationsPdf,
    generateGeneralActivityOverviewPdf,
    generateTraceabilityReportPdf
} from '../../utils/reportUtils';
import { DocumentChartBarIcon } from '../Icons';

declare global {
  interface Window {
    jspdf: any; 
  }
}

type ReportType = 
  | ''
  | 'SALES_BY_PERIOD'
  | 'INGREDIENT_STOCK_STATUS'
  | 'PACKAGING_STOCK_STATUS'
  | 'FINISHED_GOODS_STOCK_STATUS'
  | 'PRODUCTION_LOTS_BY_PERIOD'
  | 'HARVESTS_BY_PERIOD'
  | 'GENERAL_ACTIVITY_OVERVIEW'
  | 'TRACEABILITY_REPORT';

interface ReportConfig {
  value: ReportType;
  label: string;
  requiresDateRange?: boolean;
  requiresLotFabrication?: boolean;
}

const REPORT_OPTIONS: ReportConfig[] = [
  { value: '', label: "Sélectionner un type de rapport..." },
  { value: 'GENERAL_ACTIVITY_OVERVIEW', label: "Vue d'Ensemble de l'Activité Générale" },
  { value: 'TRACEABILITY_REPORT', label: "Rapport de Traçabilité Complet par Lot Fini", requiresLotFabrication: true },
  { value: 'SALES_BY_PERIOD', label: "Ventes par Période", requiresDateRange: true },
  { value: 'PRODUCTION_LOTS_BY_PERIOD', label: "Lots de Fabrication par Période", requiresDateRange: true },
  { value: 'HARVESTS_BY_PERIOD', label: "Récoltes par Période", requiresDateRange: true },
  { value: 'INGREDIENT_STOCK_STATUS', label: "État des Stocks d'Ingrédients" },
  { value: 'PACKAGING_STOCK_STATUS', label: "État des Stocks de Conditionnements" },
  { value: 'FINISHED_GOODS_STOCK_STATUS', label: "État des Stocks de Produits Finis" },
];


const RapportsTab: React.FC = () => {
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('');
  const [startDate, setStartDate] = useState<string>(formatDateForInput(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString()));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date().toISOString()));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedLotFabId, setSelectedLotFabId] = useState<string>('');

  const { allData } = useContext(DataContext);
  const { lotsFabricationData } = allData;

  const currentReportConfig = useMemo(() => {
    return REPORT_OPTIONS.find(opt => opt.value === selectedReportType);
  }, [selectedReportType]);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedReportType) {
      alert("Veuillez sélectionner un type de rapport.");
      return;
    }

    if (currentReportConfig?.requiresDateRange) {
      if (!startDate || !endDate) {
        alert("Veuillez sélectionner une date de début et une date de fin pour ce rapport.");
        return;
      }
      if (new Date(startDate) > new Date(endDate)) {
        alert("La date de début ne peut pas être postérieure à la date de fin.");
        return;
      }
    }
    
    if (currentReportConfig?.requiresLotFabrication) {
        if (!selectedLotFabId) {
            alert("Veuillez sélectionner un lot de fabrication pour ce rapport.");
            return;
        }
    }

    setIsLoading(true);
    try {
      switch (selectedReportType) {
        case 'SALES_BY_PERIOD':
          await generateSalesPdfReport(allData, startDate, endDate);
          break;
        case 'INGREDIENT_STOCK_STATUS':
          await generateIngredientStockStatusPdf(allData);
          break;
        case 'PACKAGING_STOCK_STATUS':
          await generatePackagingStockStatusPdf(allData);
          break;
        case 'FINISHED_GOODS_STOCK_STATUS':
          await generateFinishedGoodsStockStatusPdf(allData);
          break;
        case 'PRODUCTION_LOTS_BY_PERIOD':
          await generateProductionLotsPdf(allData, startDate, endDate);
          break;
        case 'HARVESTS_BY_PERIOD':
          await generateHarvestsPdf(allData, startDate, endDate);
          break;
        case 'GENERAL_ACTIVITY_OVERVIEW':
          await generateGeneralActivityOverviewPdf(allData);
          break;
        case 'TRACEABILITY_REPORT':
            await generateTraceabilityReportPdf(allData, selectedLotFabId);
            break;
        default:
          alert("Ce type de rapport n'est pas encore implémenté.");
      }
    } catch (error: any) {
      console.error("Erreur lors de la génération du rapport PDF :", { message: error.message });
      alert("Une erreur est survenue lors de la génération du rapport PDF.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedReportType, startDate, endDate, currentReportConfig, selectedLotFabId, allData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <DocumentChartBarIcon className="w-7 h-7 mr-2 text-brand-primary" />
        <h2 className="text-2xl font-semibold text-brand-dark">Génération de Rapports</h2>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-brand-dark mb-1">Sélectionner un Rapport</h3>
           <p className="text-sm text-gray-600 mb-4">
            Choisissez le type de rapport que vous souhaitez générer. Certains rapports peuvent nécessiter des filtres supplémentaires.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-3">
              <label htmlFor="reportType" className="block text-sm font-medium text-gray-700 mb-1">
                Type de Rapport :
              </label>
              <select
                id="reportType"
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2 bg-white"
              >
                {REPORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {currentReportConfig?.requiresDateRange && (
              <>
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début :
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin :
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2"
                  />
                </div>
              </>
            )}
            
            {currentReportConfig?.requiresLotFabrication && (
              <div className="md:col-span-3">
                 <label htmlFor="lotFabId" className="block text-sm font-medium text-gray-700 mb-1">
                    Lot de Fabrication Fini :
                  </label>
                 <select
                    id="lotFabId"
                    value={selectedLotFabId}
                    onChange={(e) => setSelectedLotFabId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2 bg-white"
                  >
                    <option value="">Sélectionner un lot</option>
                    {lotsFabricationData
                        .sort((a,b) => new Date(b.dateFabrication).getTime() - new Date(a.dateFabrication).getTime())
                        .map(lot => (
                        <option key={lot.id} value={lot.id}>
                            {lot.lotNumeroProduitFini} - {lot.nomProduitFini} ({formatDateForInput(lot.dateFabrication)})
                        </option>
                    ))}
                  </select>
              </div>
            )}
            
            <div className={"md:col-span-3 flex justify-end mt-4"}>
                <button
                  onClick={handleGenerateReport}
                  disabled={isLoading || !selectedReportType}
                  className="w-full md:w-auto justify-center px-6 py-2.5 bg-brand-primary text-white rounded-md shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Génération...' : 'Générer le Rapport PDF'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RapportsTab;
