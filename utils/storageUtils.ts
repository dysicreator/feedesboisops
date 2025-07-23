
import { AllData, ActivityEvent, User, StorageKey } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore';

// NEW: Helper function to create a deep, plain copy of an object for JSON serialization,
// removing any class instances or circular references from Firestore.
export const sanitizeForJSON = (data: any): any => {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }
  // Firestore Timestamps have a toDate method, convert them to ISO strings.
  if (typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeForJSON);
  }
  // Handle plain objects
  const sanitized: { [key: string]: any } = {};
  for (const key of Object.keys(data)) {
    // This check is implicitly handled by Object.keys, which only returns own properties.
    sanitized[key] = sanitizeForJSON(data[key]);
  }
  return sanitized;
};


export const logActivity = async (event: Omit<ActivityEvent, 'id' | 'timestamp' | 'userId' | 'userName'>, user: User) => {
  try {
    const fullEvent: Omit<ActivityEvent, 'id'> = {
      ...event,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.nom,
    };
    
    const activityFeedRef = collection(db, 'activityFeedData');
    await addDoc(activityFeedRef, fullEvent);

    // Optional: Prune old activities to keep the collection size in check.
    // This maintains the 100 most recent entries.
    const q = query(activityFeedRef, orderBy('timestamp', 'desc'), limit(150)); // Check if we are over a threshold
    const querySnapshot = await getDocs(q);
    if (querySnapshot.size >= 150) {
        const allDocsSnapshot = await getDocs(query(activityFeedRef, orderBy('timestamp', 'asc')));
        const docsToDeleteCount = allDocsSnapshot.size - 100; // Keep newest 100
        if (docsToDeleteCount > 0) {
            const deleteOpBatch = writeBatch(db);
            allDocsSnapshot.docs.slice(0, docsToDeleteCount).forEach(docToDelete => {
                deleteOpBatch.delete(docToDelete.ref);
            });
            await deleteOpBatch.commit();
        }
    }

  } catch (error: any) {
    console.warn("Could not log activity to Firestore:", { message: error.message, code: error.code });
  }
};

export const exportAllDataAsJSON = (allData: AllData, addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void) => {
  try {
    const dataToExport = sanitizeForJSON({ ...allData });
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(dataToExport, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `herbo_la_fee_des_bois_sauvegarde_${date}.json`;
    link.click();
    addToast('Données exportées avec succès!', 'success');
  } catch (error) {
    console.error("Error exporting data:", (error as Error).message);
    addToast("Erreur lors de l'exportation des données.", 'error');
  }
};

export const importAllDataFromJSON = (
  file: File,
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
) => {
  const reader = new FileReader();

  reader.onload = async (event) => {
    try {
      if (!event.target?.result) {
        throw new Error("Le fichier est vide ou illisible.");
      }

      const dataToImport: AllData = JSON.parse(event.target.result as string);
      
      if (!dataToImport || typeof dataToImport !== 'object' || !dataToImport.parametresData) {
        throw new Error("Format de fichier JSON invalide.");
      }

      if (!window.confirm("ATTENTION : Vous êtes sur le point de remplacer TOUTES les données existantes par le contenu de ce fichier. Cette action est irréversible. Continuer ?")) {
        addToast("Importation annulée.", 'info');
        return;
      }
      
      addToast("Importation en cours... Ceci peut prendre un moment.", 'info');

      const batch = writeBatch(db);

      for (const key of Object.keys(dataToImport) as Array<keyof AllData>) {
        const collectionName = key as StorageKey;
        const dataArrayOrObject = dataToImport[key];
        
        if (collectionName === 'companyInfoData' && !Array.isArray(dataArrayOrObject)) {
            const companyInfo = dataArrayOrObject as { id: string, [key: string]: any };
            const docRef = doc(db, collectionName, companyInfo.id || 'company_info_main');
            const { id, ...rest } = companyInfo;
            batch.set(docRef, rest);
        } else if (Array.isArray(dataArrayOrObject)) {
          dataArrayOrObject.forEach((item: any) => {
            if (item.id) {
              const docRef = doc(db, collectionName, item.id);
              const { id, ...rest } = item;
              batch.set(docRef, rest);
            } else {
              console.warn(`Item in ${collectionName} is missing an ID and will be skipped.`, item);
            }
          });
        }
      }

      await batch.commit();

      addToast("Données importées avec succès ! L'application va se recharger.", 'success');
      
      setTimeout(() => window.location.reload(), 1500);

    } catch (e: any) {
      console.error("Failed to import data:", (e as Error).message);
      addToast(`Échec de l'importation : ${e.message}`, 'error');
    }
  };

  reader.onerror = (error) => {
    console.error("File reading error:", (error as any)?.message || 'An unknown file reading error occurred');
    addToast("Impossible de lire le fichier.", 'error');
  };

  reader.readAsText(file);
};