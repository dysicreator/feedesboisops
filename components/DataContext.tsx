import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { AllData, StorageKey, User } from '../types';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, onSnapshot, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { initialParametres, initialProduitsFiniBase, initialIngredients, initialConditionnements, initialIntrantsAgricoles } from '../data/initialData';
import { useToast } from './ToastProvider';

interface DataContextType {
    allData: AllData;
    isLoading: boolean;
    isFirebaseConfigured: boolean;
}

// All data collections we want to sync from Firestore
const COLLECTIONS_TO_SYNC: StorageKey[] = [
    'companyInfoData', 'parametresData', 'produitsFiniBaseData', 'travailleursData', 'ingredientsAchetesData',
    'conditionnementsData', 'intrantsAgricolesData', 'recettesData', 'culturesData', 'recoltesData',
    'etapesTransformationData', 'lotsFabricationData', 'indicateursManuelsData', 'ventesData',
    'seuilsIngredientsGeneriquesData', 'seuilsConditionnementsData', 'seuilsIntrantsAgricolesData',
    'activityFeedData', 'usersData'
];

// Define which collections should be treated as single objects, not arrays
const SINGLE_DOC_COLLECTIONS: StorageKey[] = ['companyInfoData'];

const initialAllData: AllData = {
    usersData: [],
    companyInfoData: {
      id: 'company_info_main', name: "Herboristerie La Fée des Bois", address: "123 Rue des Plantes\nVille, QC J0X 1A0",
      phone: "819-555-1234", email: "contact@feedesbois.com", website: "www.feedesbois.com",
      taxId: "TPS/TVQ:---", logoBase64: "", bankDetails: "Banque ABC - IBAN: FR... - BIC: ...",
      invoiceFooterText: "Merci de votre confiance."
    },
    parametresData: initialParametres,
    produitsFiniBaseData: initialProduitsFiniBase,
    travailleursData: [],
    ingredientsAchetesData: initialIngredients,
    conditionnementsData: initialConditionnements,
    intrantsAgricolesData: initialIntrantsAgricoles,
    recettesData: [],
    culturesData: [],
    recoltesData: [],
    etapesTransformationData: [],
    lotsFabricationData: [],
    indicateursManuelsData: [],
    ventesData: [],
    seuilsIngredientsGeneriquesData: [], 
    seuilsConditionnementsData: [],
    seuilsIntrantsAgricolesData: [],
    activityFeedData: [],
};


export const DataContext = createContext<DataContextType>({
    allData: initialAllData,
    isLoading: true,
    isFirebaseConfigured: isFirebaseConfigured,
});

interface DataProviderProps {
    children: ReactNode;
    currentUser: User | null;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children, currentUser }) => {
    const [allData, setAllData] = useState<AllData>(initialAllData);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const isConnectionLost = useRef(false);

    useEffect(() => {
        if (!currentUser) {
            setAllData(initialAllData);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        
        const unsubscribers = COLLECTIONS_TO_SYNC.map((key) => {
            let unsubscribe: () => void = () => {};

            const connectWithRetry = () => {
                try {
                    const collRef = collection(db, key);
                    unsubscribe = onSnapshot(collRef, 
                        (snapshot) => {
                            if (isConnectionLost.current) {
                                addToast("Connexion à Firestore rétablie.", "success");
                                isConnectionLost.current = false;
                            }

                            let data: any;
                            if (SINGLE_DOC_COLLECTIONS.includes(key)) {
                                if (snapshot.docs.length > 0) {
                                    const doc = snapshot.docs[0];
                                    data = { id: doc.id, ...doc.data() };
                                } else {
                                    data = initialAllData[key as keyof AllData]; // Fallback to initial default
                                }
                            } else {
                                data = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
                                    id: doc.id,
                                    ...doc.data(),
                                }));
                            }
                            
                            setAllData((prevData) => ({
                                ...prevData,
                                [key]: data,
                            }));
                        }, 
                        (error: any) => {
                            console.error(`Firestore connection error for ${key}:`, { code: error.code, message: error.message });
                            if (!isConnectionLost.current) {
                                addToast("Connexion à Firestore en attente... Vérifiez votre internet.", "warning");
                                isConnectionLost.current = true;
                            }
                            // Cleanup the failed listener before retrying
                            if(typeof unsubscribe === 'function') unsubscribe();
                            setTimeout(connectWithRetry, 5000);
                        }
                    );
                } catch(err: any) {
                     console.error(`Initial connection to ${key} failed, retrying in 5s:`, { message: err.message, code: err.code });
                     if (!isConnectionLost.current) {
                        addToast("Connexion à Firestore en attente... Vérifiez votre internet.", "warning");
                        isConnectionLost.current = true;
                     }
                     // Cleanup just in case
                     if(typeof unsubscribe === 'function') unsubscribe();
                     setTimeout(connectWithRetry, 5000);
                }
            };
            
            connectWithRetry();
            return () => {
                if(typeof unsubscribe === 'function') unsubscribe();
            };
        });

        // Set loading to false once all initial listeners are set up.
        // The retry logic will handle async connection issues in the background.
        setIsLoading(false);

        return () => {
            unsubscribers.forEach((unsub) => unsub());
        };
    }, [currentUser, addToast]);

    return (
        <DataContext.Provider value={{ allData, isLoading, isFirebaseConfigured }}>
            {children}
        </DataContext.Provider>
    );
};
