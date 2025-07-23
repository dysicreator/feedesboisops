import React, { useState } from 'react';
import { LeafIcon, InformationCircleIcon, PencilIcon, TrashIcon, LightBulbIcon } from '../Icons';
import { TabKey } from '../../types'; 
import FeatureSpotlightModal from '../FeatureSpotlightModal';

interface AccueilTabProps {
  setActiveTab: (tabKey: TabKey) => void;
}

const ClickableKeyword: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="font-medium text-brand-primary hover:text-brand-dark hover:underline focus:outline-none focus:underline transition-colors"
  >
    {children}
  </button>
);

// NEW, COMPREHENSIVE AND DETAILED GUIDED TOUR STEPS
const fullWorkflowSpotlightSteps = [
  { 
    title: "Étape 1: La Fondation - 'Paramètres'",
    content: "Bienvenue ! Cette visite vous guide à travers tout le flux de travail de l'application. <br/><br/> <b>Tout commence dans l'onglet <span class='font-semibold text-brand-primary'>'Paramètres'</span>.</b> C'est la base de tout. Ici, vous créez vos listes de référence : les plantes que vous cultivez, les ingrédients que vous achetez, vos produits finis, les unités de mesure (g, ml...), et les seuils d'alerte pour les stocks bas. Une bonne configuration ici est la clé."
  },
  { 
    title: "Étape 2: Votre Équipe - 'Travailleurs'",
    content: "Allez dans l'onglet <span class='font-semibold text-brand-primary'>'Travailleurs'</span>. Enregistrez ici chaque membre de votre équipe et leur taux horaire. Ces informations seront utilisées plus tard pour calculer automatiquement les coûts de main-d'œuvre pour vos cultures, récoltes et fabrications, vous donnant une vision précise de vos coûts de production."
  },
  {
    title: "Étape 3: L'Inventaire - 'Ingrédients Achetés'",
    content: "Dans <span class='font-semibold text-brand-primary'>'Ingrédients Achetés'</span>, vous gérez votre stock d'ingrédients comme les huiles, les cires, etc. <br/><br/> Chaque achat est un <b>lot unique</b> avec sa propre quantité, son coût et sa date de péremption. Vous ne tapez pas le nom de l'ingrédient, vous le sélectionnez depuis la liste de référence que vous avez créée dans les 'Paramètres', garantissant ainsi la cohérence des données."
  },
  {
    title: "Étape 4: L'Inventaire - 'Conditionnements'",
    content: "L'onglet <span class='font-semibold text-brand-primary'>'Conditionnements'</span> fonctionne sur le même principe. Chaque achat de pots, flacons, ou étiquettes est enregistré comme un lot traçable. Cela vous permet de savoir exactement combien de contenants il vous reste et de calculer leur coût dans vos produits finis."
  },
  {
    title: "Étape 5: L'Inventaire - 'Intrants Agricoles'",
    content: "Enfin, dans <span class='font-semibold text-brand-primary'>'Intrants Agricoles'</span>, vous suivez les lots de semences, compost, ou autres traitements. Le suivi par lot est essentiel pour la traçabilité et pour calculer le coût exact de vos cultures."
  },
  { 
    title: "Étape 6: Le Journal de Bord - 'Cultures'",
    content: "Maintenant que vos entrées sont gérées, passons à la production. Une 'Culture' dans l'onglet <span class='font-semibold text-brand-primary'>'Cultures'</span> est un <b>projet à long terme</b>. Vous créez un enregistrement ici lorsque vous plantez une nouvelle culture, en indiquant la parcelle et la date de plantation. Cet enregistrement suivra la vie de votre plante dans le champ."
  },
  {
    title: "Étape 7: Suivi des Coûts de Culture",
    content: "Pendant que votre culture pousse, <b>modifiez</b> son enregistrement dans l'onglet 'Cultures' pour ajouter les heures de travail de vos employés et les intrants agricoles utilisés. Le système calculera et affichera automatiquement le <b>'Coût de Production de la Culture'</b> en temps réel."
  },
  { 
    title: "Étape 8: Le Moment Clé - 'Récoltes'",
    content: "Le jour J, allez dans <span class='font-semibold text-brand-primary'>'Récoltes'</span>. Une 'Récolte' est un <b>événement</b> que vous liez à une 'Culture' existante. Cela garantit une traçabilité parfaite. Vous enregistrez la quantité brute récoltée et les coûts de main-d'œuvre spécifiques à cette journée."
  },
  { 
    title: "Étape 9: Du Frais au Sec (Post-Récolte)",
    content: "Après le séchage, ne créez pas une nouvelle entrée. <b>Modifiez la 'Récolte' existante</b> pour y ajouter le 'Poids Après Séchage' et changez son statut à <b>'Séchée'</b>. À ce moment, votre récolte devient une matière première disponible en stock, avec un coût unitaire qui inclut tous les coûts depuis la plantation."
  },
  {
    title: "Étape 10: Création d'Intermédiaires - 'Étapes Transformation'",
    content: "Parfois, une matière première doit être transformée (ex: macération huileuse). L'onglet <span class='font-semibold text-brand-primary'>'Étapes Transformation'</span> est là pour ça. Vous sélectionnez un lot entrant (une récolte séchée, par exemple), décrivez le processus, et créez un nouveau lot sortant avec son propre coût et sa propre traçabilité."
  },
  { 
    title: "Étape 11: Le Plan Directeur - 'Recettes'",
    content: "Dans <span class='font-semibold text-brand-primary'>'Recettes'</span>, vous créez les <b>modèles</b> de vos produits finis. Une recette est un plan qui n'affecte pas votre stock. Vous y listez les composants (en liant aux références de vos paramètres) et les quantités nécessaires. Le système vous donnera une estimation du coût des matières premières pour la recette."
  },
  { 
    title: "Étape 12: La Production - 'Lots Fabrication'",
    content: "C'est le cœur de la gestion des stocks. Dans <span class='font-semibold text-brand-primary'>'Lots Fabrication'</span>, vous enregistrez une production réelle. Vous sélectionnez une recette, et le système pré-remplit les composants. Votre rôle est de choisir les <b>lots spécifiques</b> de matières premières et de conditionnements que vous utilisez. Leurs stocks seront alors automatiquement déduits."
  },
  { 
    title: "Étape 13: L'Inventaire Final - 'Ventes & Stock PF'",
    content: "Quand un 'Lot de Fabrication' est marqué comme 'Commercialisable', il apparaît dans la vue 'Inventaire des Produits Finis' de l'onglet <span class='font-semibold text-brand-primary'>'Ventes & Stock PF'</span>. Vous y voyez d'un coup d'œil ce que vous avez de prêt à vendre, avec des alertes de stock bas et de péremption (DLUO)."
  },
  { 
    title: "Étape 14: Enregistrer une Vente",
    content: "Dans l'onglet <span class='font-semibold text-brand-primary'>'Ventes & Stock PF'</span>, basculez sur la vue 'Enregistrement des Ventes'. Cliquez pour ajouter une vente, sélectionnez le produit puis le <b>lot de fabrication spécifique</b> que vous vendez. Le stock de ce lot est mis à jour, et la marge brute de la vente est calculée instantanément."
  },
  {
    title: "Étape 15: Le Suivi de la Performance - 'Indicateurs'",
    content: "L'onglet <span class='font-semibold text-brand-primary'>'Indicateurs'</span> vous aide à suivre vos objectifs. Il y a deux types : les <b>indicateurs automatisés</b> (calculés à partir de vos données, comme le revenu total) et les <b>objectifs manuels</b> (pour des choses comme la satisfaction client) que vous mettez à jour vous-même."
  },
  {
    title: "Étape 16: La Vue d'Ensemble - 'Tableau de Bord'",
    content: "Le <span class='font-semibold text-brand-primary'>'Tableau de Bord'</span> est votre page d'accueil opérationnelle. Il vous donne une vue d'ensemble de vos finances, des alertes d'inventaire critiques, des graphiques de performance et un fil d'activités récentes pour voir ce qui s'est passé dernièrement dans l'application."
  },
  {
    title: "Étape 17: Les Documents Officiels - 'Rapports'",
    content: "Enfin, l'onglet <span class='font-semibold text-brand-primary'>'Rapports'</span> vous permet de générer des documents PDF détaillés pour vos archives, votre comptabilité ou des audits. Le plus puissant est le <b>'Rapport de Traçabilité Complet'</b>, qui peut retracer un lot de produit fini jusqu'à la parcelle de culture de ses plantes."
  },
  { 
    title: "Conclusion",
    content: "Félicitations ! Vous avez parcouru l'ensemble du flux de travail. Chaque donnée que vous entrez enrichit le système et vous donne une vision plus claire et plus précise de votre herboristerie. Explorez, expérimentez, et n'oubliez pas d'utiliser les fonctions d'import/export pour sauvegarder vos données."
  },
];


const AccueilTab: React.FC<AccueilTabProps> = ({ setActiveTab }) => {
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <h2 className="text-2xl font-semibold text-brand-dark flex items-center">
            <InformationCircleIcon className="w-7 h-7 mr-2 text-brand-primary" /> Accueil et Informations
        </h2>
          <button
            onClick={() => setIsSpotlightOpen(true)}
            className="flex items-center px-4 py-2 bg-brand-secondary text-white rounded-md shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-colors"
          >
            <LightBulbIcon className="w-5 h-5 mr-2" />
            Visite Guidée Complète
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow space-y-4 text-gray-700">
            <div className="flex items-center space-x-3 mb-6">
                <LeafIcon className="h-12 w-12 text-brand-primary" />
                <div>
                    <h3 className="text-xl font-semibold text-brand-dark">Bienvenue sur l'outil de Suivi Opérationnel</h3>
                    <p className="text-sm text-gray-500">Herboristerie La Fée des Bois</p>
                </div>
            </div>

            <p>
                Cette application est conçue pour vous aider à suivre l'ensemble de la chaîne de valeur de votre herboristerie,
                depuis les cultures jusqu'aux produits finis et leur vente.
            </p>
            
            <h4 className="font-semibold text-lg text-brand-dark pt-2">Fonctionnalités principales :</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Gestion des <ClickableKeyword onClick={() => setActiveTab('parametres')}>Paramètres</ClickableKeyword> de base (produits, unités, seuils d'alerte, etc.).</li>
                <li>Suivi des <ClickableKeyword onClick={() => setActiveTab('travailleurs')}>Travailleurs</ClickableKeyword> et de leurs coûts.</li>
                <li>Inventaire des <ClickableKeyword onClick={() => setActiveTab('ingredientsAchetes')}>Ingrédients Achetés</ClickableKeyword> par lots, avec suivi des coûts et dates de péremption.</li>
                <li>Gestion des <ClickableKeyword onClick={() => setActiveTab('conditionnements')}>Conditionnements</ClickableKeyword> et de leurs stocks.</li>
                <li>Suivi des <ClickableKeyword onClick={() => setActiveTab('intrantsAgricoles')}>Intrants Agricoles</ClickableKeyword> par lots.</li>
                <li>Suivi des <ClickableKeyword onClick={() => setActiveTab('cultures')}>Cultures</ClickableKeyword> sur le long terme (plantation, parcelles, coûts de production...).</li>
                <li>Enregistrement des <ClickableKeyword onClick={() => setActiveTab('recoltes')}>Récoltes</ClickableKeyword> en tant qu'événements liés à une culture, avec calcul de rendements et coûts.</li>
                <li>Création et gestion des <ClickableKeyword onClick={() => setActiveTab('recettes')}>Recettes</ClickableKeyword> pour vos produits.</li>
                <li>Suivi des <ClickableKeyword onClick={() => setActiveTab('etapesTransformation')}>Étapes de Transformation</ClickableKeyword> (séchage, macération...) avec calcul de coûts affiné.</li>
                <li>Traçabilité des <ClickableKeyword onClick={() => setActiveTab('lotsFabrication')}>Lots de Fabrication</ClickableKeyword> de produits finis, incluant le calcul précis du <span className="font-semibold">prix de revient</span>.</li>
                <li>Module de <ClickableKeyword onClick={() => setActiveTab('ventesEtStockPF')}>Ventes & Stock Produits Finis</ClickableKeyword> avec calcul des <span className="font-semibold">marges brutes</span>.</li>
                <li>Analyse des <ClickableKeyword onClick={() => setActiveTab('indicateurs')}>Indicateurs de Performance</ClickableKeyword> (KPIs) automatiques et manuels.</li>
                <li>Génération de <ClickableKeyword onClick={() => setActiveTab('rapports')}>Rapports</ClickableKeyword> PDF (ventes, stocks, etc.).</li>
                <li>Visualisation des données clés sur le <ClickableKeyword onClick={() => setActiveTab('tableauDeBord')}>Tableau de Bord</ClickableKeyword> avec alertes d'inventaire.</li>
                <li>Consultation de la <ClickableKeyword onClick={() => setActiveTab('documentation')}>Documentation</ClickableKeyword> complète de l'application.</li>
            </ul>

            <h4 className="font-semibold text-lg text-brand-dark pt-2">Conseils d'utilisation :</h4>
            <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Commencez par l'onglet <span className="font-semibold">'Paramètres'</span> pour définir vos plantes, produits et unités de mesure.</li>
                <li>Le flux de production agricole est : <ClickableKeyword onClick={() => setActiveTab('cultures')}>Cultures</ClickableKeyword> (créer une culture) &rarr; <ClickableKeyword onClick={() => setActiveTab('recoltes')}>Récoltes</ClickableKeyword> (enregistrer une récolte sur cette culture).</li>
                <li>Utilisez les boutons <PencilIcon className="w-4 h-4 inline-block text-brand-primary" /> et <TrashIcon className="w-4 h-4 inline-block text-red-500" /> dans les tableaux pour modifier ou supprimer des lignes.</li>
                <li>Consultez la visite guidée (bouton en haut à droite) pour un exemple pratique.</li>
                <li>Pour des explications détaillées, référez-vous à l'onglet <ClickableKeyword onClick={() => setActiveTab('documentation')}>Documentation</ClickableKeyword>.</li>
            </ul>
            
            <p className="pt-4">
                Cet outil est en constante évolution. N'hésitez pas à faire part de vos retours pour l'améliorer !
            </p>
        </div>
        <FeatureSpotlightModal
          isOpen={isSpotlightOpen}
          onClose={() => setIsSpotlightOpen(false)}
          title="Visite Guidée: Du Champ au Client"
          steps={fullWorkflowSpotlightSteps}
        />
    </div>
  );
};

export default AccueilTab;
