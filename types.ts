
import React from 'react';

export interface Identifiable {
  id: string;
}

// NEW: Company Information for Invoicing
export interface CompanyInfo extends Identifiable {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  logoBase64: string;
  bankDetails?: string;
  invoiceFooterText?: string;
}


// NEW: User Authentication
export interface User extends Identifiable {
    nom: string;
    email: string;
}

// NEW: AI Assistant Chat Message
export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  isThinking?: boolean;
}


// 1. README / Accueil (Informational, no specific data type)
export type KPIKey = 
  | 'TOTAL_REVENUE' 
  | 'GLOBAL_GROSS_MARGIN' 
  | 'AVG_SALE_VALUE' 
  | 'INGREDIENT_STOCK_VALUE' 
  | 'PACKAGING_STOCK_VALUE' 
  | 'FINISHED_GOODS_STOCK_VALUE'
  | 'TOTAL_SALES_COUNT'
  | 'TOTAL_PRODUCTION_LOTS';

export interface ActivityEvent {
    id: string;
    timestamp: string;
    type: 'Culture' | 'Récolte' | 'Fabrication' | 'Vente' | 'Transformation' | 'Paramètre' | 'Travailleur' | 'Ingrédient' | 'Conditionnement' | 'Intrant' | 'Recette' | 'Indicateur' | 'Login';
    description: string;
    tabKey?: TabKey;
    itemId?: string;
    userId: string;
    userName: string;
}

// 2. Paramètres
export interface ParametreItem extends Identifiable {
  type: 'cultureBase' | 'produitFiniBase' | 'kpiReference' | 'uniteMesure' | 'categorieIntrant' | 'autre' | 'ingredientGeneriqueRef' | 'conditionnementRef' | 'intrantAgricoleRef';
  nom: string;
  valeur?: string | number;
  unite?: string; 
  description?: string; 
  fonctionPrincipale?: string; 
  kpiKey?: KPIKey; // For automated KPIs
}

export interface ProduitFiniBase extends Identifiable { // Typically part of Parametres
  nom: string;
  categorie?: string;
  prixVenteUnitaire?: number; // For reference
  uniteVente?: string;
  description?: string;
  seuilReapprovisionnementPF?: number; // Seuil de stock bas pour ce produit fini
  delaiAlerteDLUOPF?: number; // Nombre de jours avant DLUO pour alerter
}

// Interface pour les seuils et alertes des ingrédients génériques (gérés dans ParametresTab)
export interface SeuilIngredientGenerique extends Identifiable {
  nomIngredient: string; // Nom unique de l'ingrédient (correspondant à IngredientAchete.nom)
  seuilGlobal: number; // Seuil de stock bas global pour cet ingrédient
  joursAlertePeremption?: number; // Jours avant péremption pour alerter sur les lots
}

export interface SeuilConditionnement extends Identifiable {
  nomConditionnement: string; // Unique name matching Conditionnement.nom
  seuilGlobal: number;
}

export interface SeuilIntrantAgricole extends Identifiable {
  nomIntrant: string; // Unique name matching IntrantAgricole.nom
  seuilGlobal: number;
}


// 3. Travailleurs
export interface Travailleur extends Identifiable {
  nom: string;
  role: 'Culture' | 'Récolte' | 'Séchage' | 'Transformation' | 'Conditionnement' | 'Vente' | 'Administration' | 'Autre';
  tauxHoraire?: number; // Hourly rate
  contact?: string;
  dateEmbauche: string;
  statut: 'Actif' | 'Inactif';
  notes?: string;
}

// 4. Ingrédients (achetés) - Modified for Lot Tracking
export interface IngredientAchete extends Identifiable {
  ingredientRefId: string; // Link to ParametreItem of type 'ingredientGeneriqueRef'
  nom: string; // Denormalized name from the ref for display
  type: 'Plante séchée' | 'Huile végétale' | 'Huile essentielle' | 'Cire' | 'Beurre végétal' | 'Conservateur' | 'Autre';
  fournisseur?: string;
  dateAchat?: string;
  quantiteInitiale: number; // Quantity of this specific lot when purchased
  quantiteRestante: number; // Current remaining stock of this specific lot
  unite: string; // e.g., g, kg, ml, L (denormalized from ref)
  coutUnitaire?: number; // Cost per unit for this specific lot
  numeroLotFournisseur?: string; // Supplier's lot number for this specific batch
  datePeremption?: string;
  lieuStockage?: string;
  bio?: boolean;
  notes?: string;
}

// 5. Conditionnements (Lots)
export interface Conditionnement extends Identifiable {
  conditionnementRefId: string; // Link to ParametreItem of type 'conditionnementRef'
  nom: string; // Denormalized name from the ref
  type: 'Pot' | 'Flacon' | 'Sachet' | 'Bouteille' | 'Etiquette' | 'Autre';
  matiere?: string; // e.g., Verre, Plastique PET, Kraft
  capacite?: number;
  uniteCapacite?: string; // e.g., ml, g, unité
  fournisseur?: string;
  dateAchat?: string;
  quantiteInitiale: number;
  quantiteRestante: number;
  coutUnitaire?: number;
  referenceFournisseur?: string;
  notes?: string;
}

// 6. Intrants agricoles (Lot-based)
export interface IntrantAgricole extends Identifiable {
  intrantRefId: string; // Link to ParametreItem of type 'intrantAgricoleRef'
  nom: string; // Denormalized name
  type: 'Semence' | 'Plant' | 'Compost' | 'Engrais' | 'Amendement' | 'TraitementPhyto' | 'Autre';
  fournisseur?: string;
  marque?: string;
  descriptionUsage?: string;
  quantiteInitiale: number;
  unite: string; // Denormalized
  coutTotalAchat?: number;
  coutUnitaire?: number; // Calculated: coutTotalAchat / quantiteInitiale
  dateAchat?: string;
  numeroLotFournisseur?: string;
  quantiteRestante: number;
  bioCompatible?: boolean;
  notes?: string;
}

// 7. Recettes
export interface ComposantRecette {
  _tempId?: string; // For form list management
  typeComposant: 'IngredientGenerique' | 'PlanteCultureBase'; // Generic types for recipe template
  componentGenericId: string; // For IngredientGenerique: the 'nom' of the ingredient. For PlanteCultureBase: ParametreItem.id of type='cultureBase'.
  nomPourAffichage: string; // Denormalized name for easy display (auto-filled from componentGenericId source)
  quantite: number;
  unite: string; // e.g., g, ml, unité (auto-filled from ParametreItem.unite if PlanteCultureBase, otherwise user input or standard)
  notes?: string;
}

export interface Recette extends Identifiable {
  produitFiniBaseId?: string; // Lien vers ProduitFiniBase pour une référence solide
  nomProduitFini: string; // Auto-rempli depuis ProduitFiniBase, mais modifiable si besoin
  description?: string;
  categorie?: string; // Auto-rempli depuis ProduitFiniBase
  composants: ComposantRecette[];
  instructions?: string;
  tempsPreparationEstime?: string;
  quantiteProduiteParLotReference?: number;
  uniteProductionReference?: string; // Auto-rempli depuis ProduitFiniBase
  notes?: string;
  coutMatierePremiereEstimeParLotReference?: number; // Calculated
}

// Common Sub-Interfaces for Cultures & Recoltes
export interface HeuresTravailleur {
  _tempId?: string; // For form list management
  travailleurId: string;
  nomTravailleur?: string; // Denormalized
  heures: number;
  activite?: string; // Flexible activity description
  dateActivite?: string;
}
export interface CoutIntrantUtilise {
  _tempId?: string; // For form list management
  intrantId: string; // This will now be the ID of the specific IntrantAgricole lot
  nomIntrant?: string; // Denormalized
  quantiteUtilisee: number;
  uniteUtilisation?: string; // Denormalized from intrant's unite
  dateUtilisation?: string;
}

// NEW: Cultures (long-term tracking)
export interface Culture extends Identifiable {
    nomPlante: string; // Reference to ParametreItem.nom of type='cultureBase'
    parcelle: string;
    datePlantation: string;
    statut: 'En culture' | 'Terminée' | 'Échouée';
    notes?: string;
    intrantsUtilises?: CoutIntrantUtilise[];
    travailleurs?: HeuresTravailleur[];
    coutProductionCultureEstime?: number; // Calculated on save
}

// 8. Production (Récoltes) - Now an EVENT tied to a Culture
export interface StockagePostSechage {
  _tempId?: string;
  description: string; // Ex: Seau 20L
  quantiteStockee: number;
  referenceStockage?: string; // Ex: LAV-24-001-S1
}

export interface Recolte extends Identifiable {
  cultureId: string; // Link to the specific Culture
  lotNumero: string; // Unique lot number for this harvest batch
  dateRecolte: string;
  quantiteRecolteeBrute?: number;
  poidsApresSechage?: number; // After drying
  unitePoids?: string; // Unified unit for brute, dry, and losses (e.g., g, kg)
  methodeRecolte?: string;
  methodeSechage?: string;
  lieuStockageTemporaire?: string;
  stockagePostSechage?: StockagePostSechage[];
  travailleurs?: HeuresTravailleur[]; // Workers for the harvest event itself
  intrantsUtilises?: CoutIntrantUtilise[]; // Intrants for this specific harvest event only
  coutProductionTotalEstime?: number; // CALCULATED
  coutUnitaireApresSechageEstime?: number; // CALCULATED (cost per unitPoids)
  statut: 'Récoltée' | 'Séchage en cours' | 'Séchée' | 'Échouée';
  notes?: string;
}

// 9. Transformation
export interface EtapeTransformation extends Identifiable {
  nomProcessus: string; // e.g., Macération huileuse, Distillation
  lotEntrantId: string; // ID of Recolte.id or previous EtapeTransformation.lotSortantId
  typeLotEntrant: 'Recolte' | 'EtapeTransformationPrecedente';
  matiereEntranteDescription: string; // Denormalized for display, e.g. "Lavande Séchée Lot XYZ"
  quantiteEntrante?: number; // This will store the quantity *used* in the process
  uniteEntrante?: string;
  dateDebut: string;
  dateFin?: string;
  matiereSortanteDescription: string; // e.g., "Huile de Macération Lavande Lot ABC"
  quantiteSortante?: number;
  uniteSortante?: string;
  lotSortantId: string; // Unique lot number for the output of this transformation step
  travailleurs?: HeuresTravailleur[];
  equipementUtilise?: string;
  parametresControle?: string; // e.g., Température, Durée
  pertesTransformation?: number;
  unitePertes?: string;
  coutMatiereEntranteEstime?: number;
  coutTravailDeLEtape?: number;
  coutTotalEtapeEstime?: number;
  coutUnitaireSortantEstime?: number; // Coût total divisé par la quantité sortante
  statut: 'Planifiée' | 'En cours' | 'Terminée' | 'Annulée';
  notes?: string;
}

// Fabrication de produits finis
export interface ComposantLotFabrication {
  _tempId?: string; // For form list management
  nomComposant: string; // Name of the component as per recipe or user input (ideally from Recette.ComposantRecette.nomPourAffichage)
  typeComposant: 'IngredientAchete' | 'PlanteCultivee'; // Helps determine where to look for lotUtiliseId
  lotUtiliseId: string; // Specific ID of IngredientAchete lot, or Recolte.id, or EtapeTransformation.lotSortantId
  descriptionLotUtilise?: string; // Auto-filled description of the lot used (e.g. "Huile Olive Lot X", "Lavande Récolte Y")
  quantitePrelevee: number;
  unitePrelevee: string; // Auto-filled from source lot's unit or recipe component's unit
}
export interface ConditionnementUtilise {
  _tempId?: string; // For form list management
  conditionnementId: string;
  nomConditionnement?: string; // Denormalized
  quantite: number;
}

export interface LotFabrication extends Identifiable {
  recetteId: string;
  nomProduitFini: string; // Auto-rempli depuis la Recette (via ProduitFiniBase)
  lotNumeroProduitFini: string; // Unique lot number for this batch of finished product
  dateFabrication: string;
  quantiteFabriquee: number;
  uniteFabriquee: string; // Auto-rempli depuis la Recette (via ProduitFiniBase.uniteVente)
  quantiteVendue: number; // Updated by Ventes
  composantsUtilises: ComposantLotFabrication[];
  conditionnementsUtilises?: ConditionnementUtilise[];
  travailleurs?: HeuresTravailleur[];
  dluo?: string; // Date Limite d'Utilisation Optimale
  prixRevientUnitaireEstime?: number; // CALCULATED
  prixVenteUnitaireSuggere?: number; // Can be copied from ProduitFiniBase or overridden
  statut: 'Planifiée' | 'En cours' | 'Fabriquée' | 'Contrôle Qualité' | 'Commercialisable' | 'Écartée';
  notesControleQualite?: string;
  notes?: string;
}

// Ventes (now a more general Transaction document)
export interface Vente extends Identifiable {
  dateVente: string;
  invoiceNumber: string; // Ex: PRO-2024-001 ou INV-2024-001
  statut: 'Proforma' | 'Facturée' | 'Payée' | 'Annulée';
  produitFiniBaseId: string; // ID du ProduitFiniBase vendu
  nomProduitVendu?: string; // Nom du produit (dénormalisé, depuis ProduitFiniBase ou LotFabrication)
  lotFabricationId: string; // ID du LotFabrication spécifique vendu
  numeroLotVendu?: string; // Numéro de lot (dénormalisé, depuis LotFabrication)
  quantiteVendue: number;
  uniteVente: string; // Dénormalisé de ProduitFiniBase
  prixVenteUnitaire: number;
  prixVenteTotal?: number; // Calculé: quantiteVendue * prixVenteUnitaire
  client?: string; // Client name
  clientDetails?: string; // Client address, contact info
  canalVente?: 'En ligne' | 'Marché' | 'Boutique' | 'Autre';
  notes?: string; // Internal notes
  paymentTerms?: string; // Terms for the invoice
}



// KPIs / Indicateurs
export interface IndicateurManuel extends Identifiable { // Renamed from Indicateur to be specific
  nom: string;
  categorie?: string;
  valeurCible?: string | number;
  valeurActuelle: string | number;
  unite: string;
  dateEnregistrement: string;
  periodeReference?: string;
  tendance?: 'Hausse' | 'Baisse' | 'Stable';
  notes?: string;
}

// Types for Alerts
export type AlertType =
  | 'LOW_STOCK_INGREDIENT_GENERIC'
  | 'EXPIRY_INGREDIENT_LOT'
  | 'LOW_STOCK_PACKAGING'
  | 'LOW_STOCK_AGRICULTURAL_INPUT'
  | 'LOW_STOCK_FINISHED_PRODUCT'
  | 'DLUO_FINISHED_PRODUCT_LOT';

export interface AlertItem extends Identifiable { // id will be item_id + type
  type: AlertType;
  itemName: string; // Generic name of the item
  lotNumero?: string; // Specific lot number if applicable
  message: string; // e.g., "Stock: 5 / Seuil: 10" or "Expire dans 7 jours"
  currentValue: number | string; // Current stock or days to expiry
  thresholdValue?: number | string; // Threshold stock or warning period days
  severity: 'warning' | 'critical'; // For styling
  relatedTabKey?: TabKey; // To link to the relevant tab
  relatedItemId?: string; // ID of the specific item or lot in alert
}


export type Entity = IndicateurManuel | Recolte | IngredientAchete | Travailleur | LotFabrication | EtapeTransformation | ParametreItem | ProduitFiniBase | Conditionnement | IntrantAgricole | Recette | Vente | SeuilIngredientGenerique | SeuilConditionnement | SeuilIntrantAgricole | Culture | User;
export type AllData = {
  usersData: User[];
  companyInfoData: CompanyInfo;
  parametresData: ParametreItem[];
  produitsFiniBaseData: ProduitFiniBase[];
  travailleursData: Travailleur[];
  ingredientsAchetesData: IngredientAchete[];
  conditionnementsData: Conditionnement[];
  intrantsAgricolesData: IntrantAgricole[];
  recettesData: Recette[];
  culturesData: Culture[];
  recoltesData: Recolte[];
  etapesTransformationData: EtapeTransformation[];
  lotsFabricationData: LotFabrication[];
  indicateursManuelsData: IndicateurManuel[];
  ventesData: Vente[];
  seuilsIngredientsGeneriquesData: SeuilIngredientGenerique[];
  seuilsConditionnementsData: SeuilConditionnement[];
  seuilsIntrantsAgricolesData: SeuilIntrantAgricole[];
  activityFeedData: ActivityEvent[];
};


// For DataForm configuration
export interface FormFieldOption {
  value: string | number;
  label: string;
}

export type DynamicEntityType =
  | 'travailleurs'
  | 'ingredientsAchetes' // Refers to specific lots of purchased ingredients
  | 'ingredientsAchetesNomsUniques' // For selecting a generic ingredient name (e.g. "Huile d'olive")
  | 'cultures' // Refers to active cultures
  | 'recoltes' // Refers to specific harvest lots
  | 'etapesTransformation' // Refers to specific output lots of transformation steps
  | 'intrantsAgricoles'
  | 'intrantsAgricolesNomsUniques'
  | 'conditionnements' // Refers to specific lots of packaging
  | 'conditionnementsNomsUniques' // For selecting a generic packaging name
  | 'recettes'
  | 'lotsFabrication' // Added for VentesEtStockPFTab
  | 'lotsFabricationCommercialisables' // Filtered for sales tab
  | 'produitsFiniBase'
  | 'parametres' // Generic parameters list
  | 'parametresCultureBase' // Filtered Parametres for type='cultureBase'
  | 'parametresUniteMesure' // Filtered Parametres for type='uniteMesure'
  | 'parametresIngredientGeneriqueRef'
  | 'parametresConditionnementRef'
  | 'parametresIntrantAgricoleRef'
  ;

export interface AutoFillConfig<T extends Identifiable> {
  sourceField: keyof T | string | ((entity: any, allData?: AllData) => any); // Can be a path or a function to get the value
  targetFormField: string;
}

export interface FormFieldConfig<T> {
  name: keyof T | string; // Use string for nested paths or complex keys not directly on T
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'multiselect_stub' | 'nested_list_stub' | 'readonly_calculated' | 'password';
  placeholder?: string;
  options?: FormFieldOption[]; // Static options
  required?: boolean;
  disabled?: boolean; // Form field is disabled
  step?: string; // For number inputs
  subFormConfig?: FormFieldConfig<any>[]; // For 'nested_list_stub'
  defaultItem?: any | ((formData: Partial<T>) => any); // For 'nested_list_stub', default item structure

  dynamicEntityType?: DynamicEntityType; // Entity type to fetch for dynamic select options
  valueFieldForDynamicOptions?: string; // Field from dynamic entity to use as option value (defaults to 'id')
  labelFieldForDynamicOptions?: string | ((entity: any, allData?: AllData) => string); // Field for option label (defaults to 'nom')
  autoFillFields?: AutoFillConfig<any>[]; // Auto-fill other form fields when this select changes

  // Contextual filtering for dynamic options
  filterContextField?: string; // Field in current form data that provides value for filtering (e.g., 'typeComposant')
  
  secondaryFilter?: (item: any, formDataInScope: Partial<T> | any, allData: AllData) => boolean; // Advanced custom filter. formDataInScope is current form or subform item.

  calculationFn?: (formData: Partial<T>, allData: AllData) => string | number; // For 'readonly_calculated'
  dependsOn?: (keyof T | string)[]; // Fields that trigger recalculation for readonly_calculated
  conditional?: (formDataInMemory: Partial<T>) => boolean; // For conditionally showing fields in config
}

// For DataTable configuration
export interface ColumnDefinition<T extends Identifiable> {
  accessor: keyof T | ((data: T, allData?: AllData) => React.ReactNode); // Accessor can be a key or a function
  Header: string;
  cell?: (data: T, allData?: AllData) => React.ReactNode; // Custom cell renderer function
  className?: string; // Optional class name for the cell/header
  getSearchValue?: (data: T, allData?: AllData) => string; // Optional: Function to get string value for global search
}

export type TabKey =
  | 'accueil'
  | 'parametres'
  | 'travailleurs'
  | 'ingredientsAchetes'
  | 'conditionnements'
  | 'intrantsAgricoles'
  | 'recettes'
  | 'cultures'
  | 'recoltes'
  | 'etapesTransformation'
  | 'lotsFabrication'
  | 'ventesEtStockPF'
  | 'indicateurs'
  | 'rapports'
  | 'tableauDeBord'
  | 'documentation';

export interface TabConfig {
  key: TabKey;
  label: string;
  icon?: React.ReactNode;
}

export type StorageKey =
  | 'usersData'
  | 'companyInfoData'
  | 'parametresData'
  | 'produitsFiniBaseData'
  | 'travailleursData'
  | 'ingredientsAchetesData'
  | 'conditionnementsData'
  | 'intrantsAgricolesData'
  | 'recettesData'
  | 'culturesData'
  | 'recoltesData'
  | 'etapesTransformationData'
  | 'lotsFabricationData'
  | 'indicateursManuelsData'
  | 'ventesData'
  | 'seuilsIngredientsGeneriquesData'
  | 'seuilsConditionnementsData'
  | 'seuilsIntrantsAgricolesData'
  | 'activityFeedData';


// Helper type for useLocalStorage with AllData
export type AllDataContextState = {
  allData: AllData,
  isLoading: boolean,
  isFirebaseConfigured: boolean,
};
export type SpecificDataState<K extends keyof AllData> = [AllData[K], React.Dispatch<React.SetStateAction<AllData[K]>>];

// Toast Notification Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}
