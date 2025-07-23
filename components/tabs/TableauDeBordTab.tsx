import React, { useMemo, useState, useEffect, useRef, useContext } from 'react';
import { 
    Recolte, LotFabrication, IndicateurManuel, IngredientAchete, EtapeTransformation, AllData, Conditionnement,
    Travailleur, Recette, IntrantAgricole, Vente, SeuilIngredientGenerique, AlertItem, AlertType, TabKey, ActivityEvent, Culture, User
} from '../../types'; 
import { DataContext } from '../DataContext';
import { calculateVenteDetails, getAllInventoryAlerts, formatDateForInput } from '../../utils/helpers';
import { SunIcon, CubeTransparentIcon, BeakerIcon, ArchiveBoxIcon, ChartPieIcon, CurrencyCadIcon, BanknotesIcon, ExclamationTriangleIcon, ClockIcon, InformationCircleIcon } from '../Icons';
import ChartCard from '../ChartCard';

declare global {
  interface Window {
    Chart: any; 
  }
}

interface TableauDeBordTabProps {
  setActiveTab: (tabKey: TabKey) => void;
  currentUser: User; // User is now required
}

const MetricCard: React.FC<{ title: string; value: string | number; unit?: string, icon?: React.ReactNode, note?: string }> = ({ title, value, unit, icon, note }) => (
  <div className="bg-white p-4 rounded-lg shadow-md flex flex-col justify-between h-full">
    <div className="flex items-start space-x-3">
        {icon && <div className="flex-shrink-0 text-brand-primary p-2 bg-brand-light rounded-full mt-1">{icon}</div>}
        <div>
            <h4 className="text-sm font-medium text-gray-500">{title}</h4>
            <p className="text-2xl font-semibold text-brand-dark">
            {value} {unit && <span className="text-sm font-normal text-gray-600">{unit}</span>}
            </p>
        </div>
    </div>
    {note && <p className="text-xs text-gray-400 mt-2">{note}</p>}
  </div>
);

const getAlertIcon = (type: AlertType, severity: 'critical' | 'warning') => {
    const color = severity === 'critical' ? 'text-red-600' : 'text-amber-500';
    switch (type) {
        case 'LOW_STOCK_INGREDIENT_GENERIC':
        case 'LOW_STOCK_PACKAGING':
        case 'LOW_STOCK_AGRICULTURAL_INPUT':
        case 'LOW_STOCK_FINISHED_PRODUCT':
            return <ExclamationTriangleIcon className={`w-5 h-5 ${color}`} />;
        case 'EXPIRY_INGREDIENT_LOT':
        case 'DLUO_FINISHED_PRODUCT_LOT':
            return <ClockIcon className={`w-5 h-5 ${color}`} />;
        default:
            return <ExclamationTriangleIcon className={`w-5 h-5 ${color}`} />;
    }
};

const TableauDeBordTab: React.FC<TableauDeBordTabProps> = ({ setActiveTab, currentUser }) => {
  const { allData } = useContext(DataContext);
  const chartInstances = useRef<{ [key: string]: any }>({});
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [startDate, setStartDate] = useState<string>(formatDateForInput(thirtyDaysAgo.toISOString()));
  const [endDate, setEndDate] = useState<string>(formatDateForInput(new Date().toISOString()));
  const [isDateFilterActive, setIsDateFilterActive] = useState<boolean>(true);
  
  const inventoryAlerts = useMemo(() => getAllInventoryAlerts(allData), [allData]);

  const recentActivityFeed: ActivityEvent[] = useMemo(() => {
      return (allData.activityFeedData || []).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allData.activityFeedData]);


  const filteredVentesData = useMemo(() => {
    if (!isDateFilterActive || !startDate || !endDate) {
      return allData.ventesData;
    }
    return allData.ventesData.filter(vente => {
      const venteDate = new Date(vente.dateVente);
      return venteDate >= new Date(startDate) && venteDate <= new Date(endDate);
    });
  }, [allData.ventesData, startDate, endDate, isDateFilterActive]);

  const handleAlertClick = (alert: AlertItem) => {
    if (alert.relatedTabKey) {
      setActiveTab(alert.relatedTabKey);
    }
  };
  
  const handleResetFilters = () => {
    setStartDate(formatDateForInput(thirtyDaysAgo.toISOString()));
    setEndDate(formatDateForInput(new Date().toISOString()));
    setIsDateFilterActive(true);
  };

  const totalRecoltes = allData.recoltesData.length;
  
  const totalValeurStockIngredients = useMemo(() => allData.ingredientsAchetesData.reduce((sum, lot) => {
    return sum + ((lot.quantiteRestante || 0) * (lot.coutUnitaire || 0));
  }, 0), [allData.ingredientsAchetesData]);

  const totalValeurStockConditionnements = useMemo(() => allData.conditionnementsData.reduce((sum, cond) => {
    return sum + ((cond.quantiteRestante || 0) * (cond.coutUnitaire || 0));
  }, 0), [allData.conditionnementsData]);
  
  const totalValeurStockPF = useMemo(() => allData.lotsFabricationData
    .filter(lot => lot.statut === 'Commercialisable' && lot.prixRevientUnitaireEstime)
    .reduce((sum, lot) => {
        const stockRestant = (lot.quantiteFabriquee || 0) - (lot.quantiteVendue || 0);
        return sum + (stockRestant * (lot.prixRevientUnitaireEstime || 0));
    }, 0), [allData.lotsFabricationData]);


  const revenuTotalVentesFiltrees = useMemo(() => filteredVentesData.reduce((sum, vente) => sum + (vente.prixVenteTotal || 0), 0), [filteredVentesData]);
  
  const coutMarchandisesVenduesFiltrees = useMemo(() => filteredVentesData.reduce((sum, vente) => {
    const lotFab = allData.lotsFabricationData.find(l => l.id === vente.lotFabricationId);
    return sum + calculateVenteDetails(vente, lotFab).coutRevientVendu;
  }, 0), [filteredVentesData, allData.lotsFabricationData]);

  const margeBruteTotaleVentesFiltrees = revenuTotalVentesFiltrees - coutMarchandisesVenduesFiltrees;

  // Chart Data Processing
  const monthlyRevenueData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    filteredVentesData.forEach(vente => {
        const month = formatDateForInput(vente.dateVente).substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = 0;
        monthlyData[month] += vente.prixVenteTotal || 0;
    });
    const sortedMonths = Object.keys(monthlyData).sort();
    return {
        labels: sortedMonths,
        datasets: [{
            label: 'Revenu Mensuel',
            data: sortedMonths.map(month => monthlyData[month]),
            backgroundColor: 'rgba(5, 150, 105, 0.6)', // emerald-600
            borderColor: 'rgba(6, 78, 59, 1)', // emerald-900
            borderWidth: 1,
        }]
    };
  }, [filteredVentesData]);

  const stockValueData = useMemo(() => ({
    labels: ['Ingrédients', 'Conditionnements', 'Produits Finis (Coût Revient)'],
    datasets: [{
        data: [
            totalValeurStockIngredients,
            totalValeurStockConditionnements,
            totalValeurStockPF,
        ],
        backgroundColor: [
            'rgba(5, 150, 105, 0.7)', // emerald-600
            'rgba(245, 158, 11, 0.7)', // amber-500
            'rgba(6, 78, 59, 0.7)', // emerald-900
        ]
    }]
  }), [totalValeurStockIngredients, totalValeurStockConditionnements, totalValeurStockPF]);

  // Chart.js Effects
  useEffect(() => {
      return () => { // Cleanup on unmount
          Object.values(chartInstances.current).forEach(chart => chart?.destroy());
      };
  }, []);

  useEffect(() => {
    const ctx = document.getElementById('monthlyRevenueChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (chartInstances.current.revenue) chartInstances.current.revenue.destroy();
    chartInstances.current.revenue = new window.Chart(ctx, {
        type: 'bar',
        data: monthlyRevenueData,
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }, [monthlyRevenueData]);

  useEffect(() => {
    const ctx = document.getElementById('stockValueChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (chartInstances.current.stock) chartInstances.current.stock.destroy();
    chartInstances.current.stock = new window.Chart(ctx, {
        type: 'doughnut',
        data: stockValueData,
        options: { responsive: true, maintainAspectRatio: false }
    });
  }, [stockValueData]);


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-brand-dark">Tableau de Bord - Vue d'Ensemble</h2>

      <div className="bg-white p-4 rounded-lg shadow-md space-y-3">
        <h3 className="text-lg font-medium text-brand-dark">Filtrer les Indicateurs Financiers par Date</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="dashboardStartDate" className="block text-sm font-medium text-gray-700">Date de début :</label>
            <input type="date" id="dashboardStartDate" value={startDate} onChange={(e) => { setStartDate(e.target.value); setIsDateFilterActive(true); }} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="dashboardEndDate" className="block text-sm font-medium text-gray-700">Date de fin :</label>
            <input type="date" id="dashboardEndDate" value={endDate} onChange={(e) => { setEndDate(e.target.value); setIsDateFilterActive(true); }} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2" />
          </div>
          <button onClick={handleResetFilters} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-secondary">Réinitialiser Filtres</button>
        </div>
         {isDateFilterActive && <p className="text-xs text-gray-500 mt-1">Affichage pour la période du {formatDateForInput(startDate)} au {formatDateForInput(endDate)}.</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
             <MetricCard title={`Revenu Ventes ${isDateFilterActive ? '(Filtré)' : ''}`} value={revenuTotalVentesFiltrees.toFixed(2)} unit="CAD" icon={<BanknotesIcon className="w-6 h-6"/>} />
             <MetricCard title={`Marge Brute ${isDateFilterActive ? '(Filtrée)' : ''}`} value={margeBruteTotaleVentesFiltrees.toFixed(2)} unit="CAD" icon={<ChartPieIcon className="w-6 h-6"/>} />
             <MetricCard title="Valeur Stock Ingrédients" value={totalValeurStockIngredients.toFixed(2)} unit="CAD" icon={<BeakerIcon className="w-6 h-6"/>} />
             <MetricCard title="Valeur Stock Conditionnements" value={totalValeurStockConditionnements.toFixed(2)} unit="CAD" icon={<ArchiveBoxIcon className="w-6 h-6"/>} />
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-brand-dark mb-3">Activités Récentes</h3>
            <ul className="space-y-3 max-h-72 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {recentActivityFeed.length > 0 ? recentActivityFeed.slice(0, 15).map(event => (
                    <li key={event.id} className="text-sm border-b border-gray-100 pb-2">
                        <p className="text-gray-700">
                          <span className="font-semibold text-brand-primary">{event.userName}</span>: {event.description}
                        </p>
                        <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString('fr-CA')}</p>
                    </li>
                )) : (
                    <p className="text-sm text-gray-500 italic">Aucune activité récente.</p>
                )}
            </ul>
        </div>
      </div>

      {inventoryAlerts.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 mr-2 text-red-600" />Alertes d'Inventaire ({inventoryAlerts.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-red-300 scrollbar-track-red-100">
            {inventoryAlerts.map(alert => (
              <div key={alert.id} className={`p-3 rounded-md border ${alert.severity === 'critical' ? 'bg-red-100 border-red-300' : 'bg-amber-100 border-amber-300'} ${alert.relatedTabKey ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`} onClick={() => alert.relatedTabKey && handleAlertClick(alert)} title={alert.relatedTabKey ? `Aller à l'onglet ${alert.relatedTabKey}` : ''}>
                <div className="flex items-center space-x-2">
                  {getAlertIcon(alert.type, alert.severity)}
                  <span className={`font-medium ${alert.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{alert.itemName}</span>
                </div>
                <p className={`text-sm ${alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Revenu Mensuel (Période Filtrée)" chartId="monthlyRevenueChart" />
          <ChartCard title="Composition de la Valeur du Stock" chartId="stockValueChart" />
      </div>

    </div>
  );
};

export default TableauDeBordTab;