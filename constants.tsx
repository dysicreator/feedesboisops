
import React from 'react';
import { TabKey, KPIKey, TabConfig } from './types';
import { 
  HomeIcon, CogIcon as ParametresIcon, UsersIcon, BeakerIcon, ArchiveBoxIcon, ShoppingCartIcon, BookOpenIcon, 
  ArrowPathIcon, CubeTransparentIcon, ChartPieIcon, InformationCircleIcon, SunIcon, BanknotesIcon, DocumentChartBarIcon,
  PlantIcon, QuestionMarkCircleIcon
} from './components/Icons'; 

export const TAB_CONFIGS: TabConfig[] = [
  { key: 'accueil', label: 'Accueil', icon: <InformationCircleIcon className="w-5 h-5" /> }, // README equivalent
  { key: 'parametres', label: 'Paramètres', icon: <ParametresIcon className="w-5 h-5" /> },
  { key: 'travailleurs', label: 'Travailleurs', icon: <UsersIcon className="w-5 h-5" /> },
  { key: 'ingredientsAchetes', label: 'Ingrédients Achetés', icon: <BeakerIcon className="w-5 h-5" /> },
  { key: 'conditionnements', label: 'Conditionnements', icon: <ArchiveBoxIcon className="w-5 h-5" /> },
  { key: 'intrantsAgricoles', label: 'Intrants Agricoles', icon: <ShoppingCartIcon className="w-5 h-5" /> },
  { key: 'cultures', label: 'Cultures', icon: <PlantIcon className="w-5 h-5" /> }, // New Tab
  { key: 'recoltes', label: 'Récoltes', icon: <SunIcon className="w-5 h-5" /> }, // Formerly Crops
  { key: 'etapesTransformation', label: 'Étapes Transformation', icon: <ArrowPathIcon className="w-5 h-5" /> }, // Formerly Transformation
  { key: 'recettes', label: 'Recettes', icon: <BookOpenIcon className="w-5 h-5" /> },
  { key: 'lotsFabrication', label: 'Lots Fabrication', icon: <CubeTransparentIcon className="w-5 h-5" /> }, // Formerly Production
  { key: 'ventesEtStockPF', label: 'Ventes & Stock PF', icon: <BanknotesIcon className="w-5 h-5" /> }, // New Tab
  { key: 'indicateurs', label: 'Indicateurs (KPIs)', icon: <ChartPieIcon className="w-5 h-5" /> }, // Formerly KPIs
  { key: 'rapports', label: 'Rapports', icon: <DocumentChartBarIcon className="w-5 h-5" /> }, // New Tab
  { key: 'documentation', label: 'Documentation', icon: <QuestionMarkCircleIcon className="w-5 h-5" /> }, // New Tab
  { key: 'tableauDeBord', label: 'Tableau de Bord', icon: <HomeIcon className="w-5 h-5" /> }, // Dashboard
];

export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";

export const KPI_CONFIGS: { key: KPIKey; label: string; unit: string; description: string }[] = [
  { key: 'TOTAL_REVENUE', label: 'Revenu Total des Ventes', unit: 'CAD', description: 'Somme de toutes les ventes enregistrées.' },
  { key: 'GLOBAL_GROSS_MARGIN', label: 'Marge Brute Globale', unit: '%', description: 'Marge brute moyenne sur toutes les ventes.' },
  { key: 'AVG_SALE_VALUE', label: 'Valeur Moyenne par Vente', unit: 'CAD', description: 'Revenu total divisé par le nombre de ventes.' },
  { key: 'INGREDIENT_STOCK_VALUE', label: 'Valeur du Stock d\'Ingrédients', unit: 'CAD', description: 'Valeur totale estimée du stock d\'ingrédients restants.' },
  { key: 'PACKAGING_STOCK_VALUE', label: 'Valeur du Stock de Conditionnements', unit: 'CAD', description: 'Valeur totale estimée du stock de conditionnements restants.' },
  { key: 'FINISHED_GOODS_STOCK_VALUE', label: 'Valeur du Stock de Produits Finis', unit: 'CAD', description: 'Valeur totale (au prix de revient) du stock de produits finis.' },
  { key: 'TOTAL_SALES_COUNT', label: 'Nombre Total de Ventes', unit: '', description: 'Nombre total de transactions de vente enregistrées.' },
  { key: 'TOTAL_PRODUCTION_LOTS', label: 'Nombre Total de Lots Fabriqués', unit: '', description: 'Nombre total de lots de fabrication créés.' },
];