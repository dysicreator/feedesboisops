
import React, { useState } from 'react';
import { useToast } from '../ToastProvider';
import { auth, isFirebaseConfigured } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

interface LoginFormProps {
  onLogin: (email: string, pass: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { addToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        addToast("Veuillez remplir l'email et le mot de passe.", "warning");
        return;
    }
    onLogin(email, password);
  };
  
  const handlePasswordReset = async () => {
    if (!isFirebaseConfigured) {
      addToast("La réinitialisation de mot de passe est désactivée en mode démo.", "info");
      return;
    }
    if (!email) {
      addToast("Veuillez entrer votre email dans le champ ci-dessus pour réinitialiser le mot de passe.", "warning");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      addToast("Email de réinitialisation envoyé. Vérifiez votre boîte de réception.", "success");
    } catch (error: any) {
      console.error("Password reset error:", { code: error.code, message: error.message });
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
          addToast("Email non trouvé. Veuillez vérifier l'adresse email.", "error");
      } else {
          addToast("Erreur lors de l'envoi de l'email de réinitialisation.", "error");
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-center text-brand-dark mb-6">Connexion</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
            placeholder="vous@example.com"
          />
        </div>
        <div>
            <div className="flex items-center justify-between">
                <label htmlFor="password"className="block text-sm font-medium text-gray-700">Mot de passe</label>
                <div className="text-sm">
                    <button
                        type="button"
                        onClick={handlePasswordReset}
                        className="font-medium text-brand-primary hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary rounded"
                    >
                        Mot de passe oublié ?
                    </button>
                </div>
            </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
          />
        </div>
        <div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
          >
            Se Connecter
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;
