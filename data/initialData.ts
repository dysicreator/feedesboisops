
import { IngredientAchete, ParametreItem, ProduitFiniBase, Conditionnement, IntrantAgricole } from '../types';
import { generateId } from '../utils/idUtils'; // Updated import

// Copied from ParametresTab.tsx and modified to use generateId once available or placeholder
export const initialCulturesBaseData: Omit<ParametreItem, 'id'>[] = [
  { type: 'cultureBase', nom: "Achillée millefeuille", description: "Plante vivace herbacée, fleurs en corymbes blanches ou roses.", fonctionPrincipale: "Cicatrisante, hémostatique, anti-inflammatoire, digestive.", unite: 'g' },
  { type: 'cultureBase', nom: "Acore odorant", description: "Plante aquatique à rhizome aromatique, feuilles en forme d'épée.", fonctionPrincipale: "Tonique digestif, stimulant, aromatique.", unite: 'g' },
  { type: 'cultureBase', nom: "Actée à grappes noires", description: "Grande plante vivace, inflorescences en longs épis de fleurs blanches.", fonctionPrincipale: "Régulatrice hormonale (féminine), anti-inflammatoire.", unite: 'g' },
  { type: 'cultureBase', nom: "Agastache fenouil", description: "Vivace aromatique au parfum anisé, épis de fleurs mauves.", fonctionPrincipale: "Digestive, carminative, expectorante, mellifère.", unite: 'g' },
  { type: 'cultureBase', nom: "Agripaume cardiaque", description: "Plante vivace robuste, fleurs roses en verticilles épineux.", fonctionPrincipale: "Cardiotonique léger, sédative nerveuse, emménagogue.", unite: 'g' },
  { type: 'cultureBase', nom: "Aigremoine eupatoire", description: "Vivace à fleurs jaunes en longs épis grêles, feuilles dentées.", fonctionPrincipale: "Astringente, anti-inflammatoire (gorge), digestive.", unite: 'g' },
  { type: 'cultureBase', nom: "Ail commun", description: "Plante bulbeuse condimentaire et médicinale universelle.", fonctionPrincipale: "Antiseptique, hypotenseur, hypocholestérolémiant, fluidifiant sanguin.", unite: 'g' },
  { type: 'cultureBase', nom: "Ail des bois", description: "Plante bulbeuse printanière, larges feuilles et saveur d'ail prononcée. Native.", fonctionPrincipale: "Dépuratif printanier, tonique, riche en vitamines.", unite: 'g' },
  { type: 'cultureBase', nom: "Ail des ours", description: "Plante bulbeuse à larges feuilles, forte odeur d'ail, fleurs blanches en ombelle.", fonctionPrincipale: "Dépuratif, hypotenseur, vermifuge, antiseptique.", unite: 'g' },
  { type: 'cultureBase', nom: "Airelle rouge / Lingonne", description: "Sous-arbrisseau rampant, petites feuilles persistantes, baies rouges acidulées.", fonctionPrincipale: "Antiseptique urinaire (feuilles), riche en antioxydants (baies).", unite: 'g' },
  { type: 'cultureBase', nom: "Alchémille commune", description: "Vivace basse, feuilles palmées veloutées retenant la rosée.", fonctionPrincipale: "Astringente, cicatrisante, régulatrice du cycle féminin.", unite: 'g' },
  { type: 'cultureBase', nom: "Alcée / Rose trémière", description: "Grande plante bisannuelle ou vivace, hautes tiges florales colorées.", fonctionPrincipale: "Adoucissante, émolliente (fleurs), expectorante.", unite: 'g' },
  { type: 'cultureBase', nom: "Alliaire officinale", description: "Plante bisannuelle à odeur d'ail, fleurs blanches en croix.", fonctionPrincipale: "Antiseptique, expectorante, condimentaire.", unite: 'g' },
  { type: 'cultureBase', nom: "Aloès", description: "Plante succulente, feuilles charnues contenant un gel mucilagineux. Culture en pot.", fonctionPrincipale: "Cicatrisant, hydratant, laxatif (suc).", unite: 'ml' },
  { type: 'cultureBase', nom: "Ancolie du Canada", description: "Vivace native, fleurs pendantes rouges et jaunes à éperons.", fonctionPrincipale: "Traditionnellement utilisée par les Premières Nations (usages variés).", unite: 'g' },
  { type: 'cultureBase', nom: "Angélique officinale", description: "Grande bisannuelle aromatique, tiges robustes, ombelles de fleurs verdâtres.", fonctionPrincipale: "Digestive, carminative, tonique, antispasmodique.", unite: 'g' },
  { type: 'cultureBase', nom: "Anis vert", description: "Plante annuelle aromatique, petites fleurs blanches en ombelles, graines parfumées.", fonctionPrincipale: "Digestif, carminatif, galactagogue, expectorant léger.", unite: 'g' },
  { type: 'cultureBase', nom: "Armoise absinthe", description: "Vivace très amère, feuillage gris argenté, petites fleurs jaunes.", fonctionPrincipale: "Tonique amer, apéritive, vermifuge (prudence).", unite: 'g' },
  { type: 'cultureBase', nom: "Armoise commune", description: "Vivace robuste, feuilles découpées vertes dessus, argentées dessous.", fonctionPrincipale: "Tonique amer, digestive, emménagogue (prudence).", unite: 'g' },
  { type: 'cultureBase', nom: "Armoise de Ludovice / Armoise blanche", description: "Vivace native au feuillage argenté très aromatique.", fonctionPrincipale: "Traditionnellement pour fumigations, anti-inflammatoire léger.", unite: 'g' },
  { type: 'cultureBase', nom: "Arnica du Canada", description: "Vivace native, fleurs jaunes semblables à l'arnica européenne.", fonctionPrincipale: "Anti-inflammatoire, anti-ecchymotique (usage externe).", unite: 'g' },
  { type: 'cultureBase', nom: "Artichaut", description: "Grande plante vivace (annuelle en climat froid), larges feuilles, capitule floral comestible.", fonctionPrincipale: "Hépatoprotecteur, cholérétique, digestif (feuilles).", unite: 'g' },
  { type: 'cultureBase', nom: "Asaret du Canada", description: "Vivace native couvre-sol d'ombre, feuilles en cœur, rhizome aromatique.", fonctionPrincipale: "Expectorant, diaphorétique, aromatique (gingembre sauvage).", unite: 'g' },
  { type: 'cultureBase', nom: "Aspérule odorante", description: "Petite vivace couvre-sol d'ombre, feuilles verticillées, parfum de foin coupé au séchage.", fonctionPrincipale: "Sédative légère, antispasmodique, aromatique (vin de mai).", unite: 'g' },
  { type: 'cultureBase', nom: "Astragale", description: "Vivace, nombreuses folioles, fleurs papilionacées. Racine utilisée.", fonctionPrincipale: "Immunostimulante, adaptogène, tonique général.", unite: 'g' },
  { type: 'cultureBase', nom: "Aubépine", description: "Arbuste ou petit arbre épineux, fleurs blanches odorantes, fruits rouges (cenelles).", fonctionPrincipale: "Cardiotonique, régulatrice du rythme cardiaque, sédative légère.", unite: 'g' },
  { type: 'cultureBase', nom: "Aunée / Grande Aunée", description: "Grande vivace robuste, larges feuilles, grandes fleurs jaunes. Racine utilisée.", fonctionPrincipale: "Expectorante puissante, antiseptique pulmonaire, tonique amer.", unite: 'g' },
  { type: 'cultureBase', nom: "Aurone / Citronnelle", description: "Arbrisseau au feuillage très découpé, aromatique (citron).", fonctionPrincipale: "Tonique amer, digestive, vermifuge léger.", unite: 'g' },
  { type: 'cultureBase', nom: "Viorne obier / Pimbina", description: "Arbuste natif, ombelles de fleurs blanches, fruits rouges vifs (Pimbina).", fonctionPrincipale: "Antispasmodique (crampes utérines et musculaires) (écorce).", unite: 'g' }
];

export const initialDefaultUnitsData: Omit<ParametreItem, 'id'>[] = [
    { type: 'uniteMesure', nom: 'Gramme', valeur: 'g', description: 'Unité de masse.' },
    { type: 'uniteMesure', nom: 'Millilitre', valeur: 'ml', description: 'Unité de volume.' },
    { type: 'uniteMesure', nom: 'Kilogramme', valeur: 'kg', description: 'Unité de masse.' },
    { type: 'uniteMesure', nom: 'Litre', valeur: 'L', description: 'Unité de volume.' },
    { type: 'uniteMesure', nom: 'Pièce/Unité', valeur: 'unité', description: 'Pour les items comptés individuellement.' },
    { type: 'uniteMesure', nom: 'Botte', valeur: 'botte', description: 'Pour les plantes vendues ou récoltées en bottes.' },
];

export const initialIngredientRefsData: ParametreItem[] = [
  { id: 'ref-ing-huile-olive', type: 'ingredientGeneriqueRef', nom: "Huile d'Olive Bio", unite: 'ml', fonctionPrincipale: "Base pour macérations, baumes, crèmes." },
  { id: 'ref-ing-cire-abeille', type: 'ingredientGeneriqueRef', nom: "Cire d'Abeille Jaune Bio", unite: 'g', fonctionPrincipale: "Épaississant et protecteur pour baumes et cérats." },
  { id: 'ref-ing-he-lavande', type: 'ingredientGeneriqueRef', nom: "HE Lavande Vraie Bio", unite: 'ml', fonctionPrincipale: "Apaisante, cicatrisante, antiseptique." },
  { id: 'ref-ing-huile-coco', type: 'ingredientGeneriqueRef', nom: "Huile de Coco Vierge Bio", unite: 'g', fonctionPrincipale: "Nourrissante et protectrice pour la peau." },
  { id: 'ref-ing-beurre-karite', type: 'ingredientGeneriqueRef', nom: "Beurre de Karité Brut Bio", unite: 'g', fonctionPrincipale: "Très nourrissant, réparateur et protecteur." },
  { id: 'ref-ing-vitamine-e', type: 'ingredientGeneriqueRef', nom: "Vitamine E (Tocophérol)", unite: 'ml', fonctionPrincipale: "Antioxydant, conservateur naturel pour phases huileuses." },
];

export const initialConditionnementRefsData: ParametreItem[] = [
  { id: 'ref-cond-pot-verre-50', type: 'conditionnementRef', nom: "Pot en verre ambré 50ml", unite: 'unité' },
  { id: 'ref-cond-flacon-pompe-100', type: 'conditionnementRef', nom: "Flacon pompe en verre 100ml", unite: 'unité' },
  { id: 'ref-cond-sachet-kraft-100', type: 'conditionnementRef', nom: "Sachet kraft doublé 100g", unite: 'unité' },
];

export const initialIntrantRefsData: ParametreItem[] = [
  { id: 'ref-intrant-compost', type: 'intrantAgricoleRef', nom: "Compost de ferme", unite: 'kg', description: "Amendement organique pour le sol." },
  { id: 'ref-intrant-semence-lavande', type: 'intrantAgricoleRef', nom: "Semences de Lavande Vraie", unite: 'g', description: "Semences pour la culture de Lavandula angustifolia." },
];


export const initialParametres: ParametreItem[] = [
    ...initialCulturesBaseData.map(p => ({ ...p, id: generateId('CB') } as ParametreItem)),
    ...initialDefaultUnitsData.map(u => ({ ...u, id: generateId('PAR-UM') } as ParametreItem)),
    ...initialIngredientRefsData.map(p => ({ ...p, id: p.id || generateId('PAR-IGR') } as ParametreItem)),
    ...initialConditionnementRefsData.map(p => ({ ...p, id: p.id || generateId('PAR-CR') } as ParametreItem)),
    ...initialIntrantRefsData.map(p => ({ ...p, id: p.id || generateId('PAR-IAR') } as ParametreItem)),
];

// Copied from ParametresTab.tsx
export const initialProduitsFiniBase: ProduitFiniBase[] = [
    { id: generateId('PFB'), nom: "Digestika", categorie: "Produit Spécial", description: "Description pour Digestika", uniteVente: "ml", prixVenteUnitaire: 20 },
    { id: generateId('PFB'), nom: "Histamina", categorie: "Produit Spécial", description: "Description pour Histamina", uniteVente: "ml", prixVenteUnitaire: 22 },
    { id: generateId('PFB'), nom: "Single Extract Collection", categorie: "Collection", description: "Description pour Single Extract Collection", uniteVente: "unité", prixVenteUnitaire: 75 },
];

// Copied from IngredientsAchetesTab.tsx
export const initialIngredients: IngredientAchete[] = [
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-huile-olive', nom: "Huile d'Olive Bio", type: 'Huile végétale', fournisseur: 'Fournisseur A', dateAchat: '2023-01-15', quantiteInitiale: 5000, quantiteRestante: 2500, unite: 'ml', coutUnitaire: 0.015, numeroLotFournisseur: 'LOT-OLIVE-001', datePeremption: '2025-01-15', lieuStockage: 'Étagère A1', bio: true, notes: 'Première pression à froid' },
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-huile-olive', nom: "Huile d'Olive Bio", type: 'Huile végétale', fournisseur: 'Fournisseur B', dateAchat: '2023-06-20', quantiteInitiale: 10000, quantiteRestante: 9500, unite: 'ml', coutUnitaire: 0.014, numeroLotFournisseur: 'LOT-OLIVE-002', datePeremption: '2025-06-20', lieuStockage: 'Étagère A1', bio: true },
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-cire-abeille', nom: "Cire d'Abeille Jaune Bio", type: 'Cire', fournisseur: 'Apiculteur Local', dateAchat: '2023-03-10', quantiteInitiale: 1000, quantiteRestante: 750, unite: 'g', coutUnitaire: 0.025, numeroLotFournisseur: 'CireJA23', datePeremption: '2026-03-10', lieuStockage: 'Boîte Cire', bio: true },
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-he-lavande', nom: "HE Lavande Vraie Bio", type: 'Huile essentielle', fournisseur: 'Distillerie Sud', dateAchat: '2023-07-01', quantiteInitiale: 100, quantiteRestante: 80, unite: 'ml', bio: true, coutUnitaire: 0.5, numeroLotFournisseur: 'HE-LAV-001', datePeremption: '2025-07-01' },
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-huile-coco', nom: "Huile de Coco Vierge Bio", type: 'Huile végétale', quantiteInitiale: 2000, quantiteRestante: 2000, unite: 'g', bio: true, dateAchat: '2023-05-01', datePeremption: '2025-05-01' },
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-beurre-karite', nom: "Beurre de Karité Brut Bio", type: 'Beurre végétal', quantiteInitiale: 1000, quantiteRestante: 1000, unite: 'g', bio: true, dateAchat: '2023-04-01', datePeremption: '2025-04-01' },
    { id: generateId('INGA'), ingredientRefId: 'ref-ing-vitamine-e', nom: "Vitamine E (Tocophérol)", type: 'Conservateur', quantiteInitiale: 50, quantiteRestante: 50, unite: 'ml', bio: false, dateAchat: '2023-02-01', datePeremption: '2025-02-01' },
];


export const initialConditionnements: Conditionnement[] = [
    { 
        id: generateId('COND'), 
        conditionnementRefId: 'ref-cond-pot-verre-50',
        nom: "Pot en verre ambré 50ml",
        type: 'Pot',
        matiere: 'Verre',
        capacite: 50,
        uniteCapacite: 'ml',
        fournisseur: 'Fournisseur Emballage',
        dateAchat: '2023-02-01',
        quantiteInitiale: 200,
        quantiteRestante: 150,
        coutUnitaire: 0.85,
        referenceFournisseur: 'POTV50A-2023',
    },
    { 
        id: generateId('COND'), 
        conditionnementRefId: 'ref-cond-sachet-kraft-100',
        nom: "Sachet kraft doublé 100g",
        type: 'Sachet',
        matiere: 'Kraft',
        capacite: 100,
        uniteCapacite: 'g',
        fournisseur: 'Fournisseur Eco',
        dateAchat: '2023-04-15',
        quantiteInitiale: 500,
        quantiteRestante: 480,
        coutUnitaire: 0.25,
        referenceFournisseur: 'SAK100-2023',
    }
];

export const initialIntrantsAgricoles: IntrantAgricole[] = [
    {
        id: generateId('INTA'),
        intrantRefId: 'ref-intrant-compost',
        nom: "Compost de ferme",
        type: 'Compost',
        fournisseur: 'Ferme locale',
        quantiteInitiale: 100,
        unite: 'kg',
        coutTotalAchat: 50,
        coutUnitaire: 0.5,
        dateAchat: '2023-03-01',
        quantiteRestante: 80,
        bioCompatible: true,
    },
    {
        id: generateId('INTA'),
        intrantRefId: 'ref-intrant-semence-lavande',
        nom: "Semences de Lavande Vraie",
        type: 'Semence',
        fournisseur: 'Semencier Bio',
        quantiteInitiale: 50,
        unite: 'g',
        coutTotalAchat: 25,
        coutUnitaire: 0.5,
        dateAchat: '2023-02-15',
        quantiteRestante: 50,
        bioCompatible: true,
    }
];
