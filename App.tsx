
import React, { useState, useEffect } from 'react';
import { User } from './types';
import AppContent from './components/AppContent';
import AuthScreen from './components/auth/AuthScreen';
import { ToastProvider, useToast } from './components/ToastProvider';
import { DataProvider } from './components/DataContext';
import { auth, db } from './firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AuthWrapper: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authView, setAuthView] = useState<'login' | 'register'>('login');
    const { addToast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // Instantly set the user to navigate to the dashboard with optimistic data.
                // This makes the login feel immediate.
                const optimisticUser: User = {
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    nom: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Utilisateur',
                };
                setCurrentUser(optimisticUser);
                setIsLoading(false);

                // In the background, check for and create the user document in Firestore.
                // This is a non-blocking "fire-and-forget" operation.
                (async () => {
                    const userDocRef = doc(db, "users", firebaseUser.uid);
                    try {
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            // Optional: If Firestore has more accurate data (e.g., an updated name),
                            // silently update the React state to reflect it.
                            const firestoreUser = { id: userDocSnap.id, ...userDocSnap.data() } as User;
                            if (firestoreUser.nom !== optimisticUser.nom) {
                                setCurrentUser(firestoreUser);
                            }
                        } else {
                            // User document is missing, create it now in the background.
                            console.log(`User document for ${firebaseUser.uid} not found. Creating in background...`);
                            const newUserDocData = {
                                nom: optimisticUser.nom,
                                email: optimisticUser.email,
                            };
                            await setDoc(userDocRef, newUserDocData);
                            console.log(`User document for ${firebaseUser.uid} created successfully.`);
                        }
                    } catch (error: any) {
                        // Per requirements, only log the error and do not block the user's session.
                        console.error("Background user document sync failed:", { code: error.code, message: error.message });
                    }
                })();
            } else {
                // No user is signed in.
                setCurrentUser(null);
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []); // Empty dependency array ensures this effect runs only once on mount.
    
    const handleRegister = async (nom: string, email: string, pass: string) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const firebaseUser = userCredential.user;
            await updateProfile(firebaseUser, { displayName: nom });
            
            // The user document is created here on registration. The onAuthStateChanged listener
            // will then pick up this new user and find the document successfully in its background check.
            const newUserDoc: Omit<User, 'id'> = {
                nom: nom,
                email: email,
            };
            
            await setDoc(doc(db, "users", firebaseUser.uid), newUserDoc);
            addToast(`Bienvenue, ${nom} ! Votre compte a été créé.`, "success");

        } catch (error: any) {
            console.error("Firebase registration error:", { code: error.code, message: error.message });
            if (error.code === 'auth/email-already-in-use') {
                addToast("Cet email est déjà enregistré, veuillez vous connecter.", "error");
                setAuthView('login');
            } else {
                addToast(`Erreur d'inscription: ${error.message}`, "error");
            }
        }
    };

    const handleLogin = async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // onAuthStateChanged will handle the navigation and background sync.
        } catch (error: any) {
             console.error("Firebase login error:", { code: error.code, message: error.message });
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                addToast("Identifiants incorrects, vérifiez votre email et votre mot de passe.", "error");
            } else {
                addToast(`Erreur de connexion: ${error.message}`, "error");
            }
        }
    };

    const handleLogout = async () => {
        if (currentUser) {
            addToast(`À bientôt, ${currentUser.nom}.`, 'info');
            await signOut(auth);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-white">Chargement...</div>;
    }

    return (
        <>
            {currentUser ? (
                <DataProvider currentUser={currentUser}>
                    <AppContent currentUser={currentUser} onLogout={handleLogout} />
                </DataProvider>
            ) : (
                <AuthScreen
                    onRegister={handleRegister}
                    onLogin={handleLogin}
                    view={authView}
                    onViewChange={setAuthView}
                />
            )}
        </>
    );
};


const App: React.FC = () => (
    <ToastProvider>
        <AuthWrapper />
    </ToastProvider>
);

export default App;
