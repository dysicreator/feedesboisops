
import React from 'react';
import { LeafIcon } from '../Icons';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthScreenProps {
  onLogin: (email: string, pass: string) => void;
  onRegister: (nom: string, email: string, pass: string) => void;
  view: 'login' | 'register';
  onViewChange: (view: 'login' | 'register') => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister, view, onViewChange }) => {
  const isLoginView = view === 'login';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-brand-dark p-8 text-center">
          <LeafIcon className="h-16 w-16 text-brand-secondary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Herboristerie La Fée des Bois</h1>
          <p className="text-brand-light/80 mt-2">Suivi Opérationnel</p>
        </div>
        
        <div className="p-8">
          {isLoginView ? (
            <LoginForm onLogin={onLogin} />
          ) : (
            <RegisterForm onRegister={onRegister} />
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => onViewChange(isLoginView ? 'register' : 'login')}
              className="text-sm font-medium text-brand-primary hover:text-brand-dark hover:underline"
            >
              {isLoginView
                ? "Pas encore de compte ? S'inscrire"
                : "Vous avez déjà un compte ? Se connecter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
