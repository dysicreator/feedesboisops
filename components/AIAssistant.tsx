import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AllData, ChatMessage } from '../types';
import { DataContext } from './DataContext';
import { XMarkIcon, SparklesIcon, LeafIcon, UsersIcon } from './Icons';
import { useToast } from './ToastProvider';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { sanitizeForJSON } from '../utils/helpers';

interface AIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

// Simple keyword-based context selection
const getRelevantDataForPrompt = (prompt: string, allData: AllData): Partial<AllData> => {
    const lowerPrompt = prompt.toLowerCase();
    const relevantData: Partial<AllData> = {};

    if (lowerPrompt.includes('stock') || lowerPrompt.includes('inventaire') || lowerPrompt.includes('combien reste')) {
        relevantData.ingredientsAchetesData = allData.ingredientsAchetesData;
        relevantData.conditionnementsData = allData.conditionnementsData;
        relevantData.lotsFabricationData = allData.lotsFabricationData;
        relevantData.recoltesData = allData.recoltesData;
    }
    if (lowerPrompt.includes('vente') || lowerPrompt.includes('revenu') || lowerPrompt.includes('profit') || lowerPrompt.includes('marge')) {
        relevantData.ventesData = allData.ventesData;
        relevantData.lotsFabricationData = allData.lotsFabricationData;
    }
    if (lowerPrompt.includes('périme') || lowerPrompt.includes('dluo')) {
        relevantData.ingredientsAchetesData = allData.ingredientsAchetesData;
        relevantData.lotsFabricationData = allData.lotsFabricationData;
    }
    if (lowerPrompt.includes('recette')) {
        relevantData.recettesData = allData.recettesData;
    }

    return Object.keys(relevantData).length > 0 ? relevantData : {};
};

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
    const [html, setHtml] = useState('');
    useEffect(() => {
        let isMounted = true;
        (async () => {
            const rawHtml = await marked.parse(content);
            if (isMounted) setHtml(DOMPurify.sanitize(rawHtml));
        })();
        return () => {
            isMounted = false;
        };
    }, [content]);

    return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
};

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose }) => {
    const { allData } = useContext(DataContext);
    const { addToast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Per instructions, API key must be from process.env.API_KEY
    const geminiApiKey = process.env.API_KEY;

    const ai = useMemo(() => {
        if (!geminiApiKey) {
            console.warn("Gemini API Key (process.env.API_KEY) is not configured. AI Assistant will be disabled.");
            return null;
        }
        return new GoogleGenAI({ apiKey: geminiApiKey });
    }, [geminiApiKey]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isThinking) return;

        if (!ai) {
            addToast("L'Assistant IA n'est pas configuré. Une clé API est manquante.", "error");
            return;
        }

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }] };
        setMessages(prev => [...prev, userMessage, { role: 'model', parts: [{ text: '' }], isThinking: true }]);
        setInput('');
        setIsThinking(true);

        try {
            const relevantData = getRelevantDataForPrompt(input, allData);
            const sanitizedData = sanitizeForJSON(relevantData);
            const contextString = Object.keys(sanitizedData).length > 0
                ? `\n\n--- CONTEXTE DE DONNÉES ---\n\`\`\`json\n${JSON.stringify(sanitizedData, null, 2)}\n\`\`\``
                : "";

            const systemInstruction = `Tu es "Fée IA", un assistant expert pour l'application de gestion de l'herboristerie "La Fée des Bois". Réponds en français, de manière concise et amicale. Utilise les données du contexte uniquement si elles existent. Ne réponds pas à des questions hors sujet. Formate tes réponses en Markdown pour plus de lisibilité.`;

            const fullPrompt = `${input}${contextString}`;

            const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: { systemInstruction }
            });

            let currentResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    currentResponse += chunkText;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'model') {
                            lastMessage.parts[0].text = currentResponse;
                            lastMessage.isThinking = false;
                        }
                        return newMessages;
                    });
                }
            }
        } catch (error: any) {
            console.error("Erreur avec l'API Gemini:", { message: error.message });
            addToast("Désolé, une erreur est survenue avec l'assistant IA.", "error");
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'model') {
                    lastMessage.parts[0].text = "Je ne peux pas répondre pour le moment. Veuillez réessayer.";
                    lastMessage.isThinking = false;
                }
                return newMessages;
            });
        } finally {
            setIsThinking(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-brand-light rounded-t-xl">
                    <div className="flex items-center space-x-3">
                        <SparklesIcon className="w-7 h-7 text-brand-secondary" />
                        <h3 className="text-xl font-semibold text-brand-dark">Fée IA - Assistant Intelligent</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fermer l'assistant">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>

                <div ref={chatContainerRef} className="flex-1 p-6 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 p-8">
                            <SparklesIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                            <p className="font-medium">Posez-moi une question sur vos opérations !</p>
                            <p className="text-sm mt-2">Ex: "Combien reste-t-il de lots de cire d'abeille ?" ou "Suggère un nom pour une tisane."</p>
                        </div>
                    )}
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
                                    <LeafIcon className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={`max-w-lg p-3 rounded-lg ${msg.role === 'user' ? 'bg-brand-primary text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                                {msg.isThinking ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                                    </div>
                                ) : (
                                    <MessageContent content={msg.parts[0].text} />
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <UsersIcon className="w-5 h-5 text-gray-600" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={ai ? "Posez votre question à Fée IA..." : "Assistant IA non disponible (clé API manquante)"}
                            disabled={isThinking || !ai}
                            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition-shadow disabled:bg-gray-100"
                        />
                        <button
                            type="submit"
                            disabled={isThinking || !input.trim() || !ai}
                            className="absolute inset-y-0 right-0 flex items-center justify-center w-12 h-full text-white bg-brand-primary rounded-full m-1 disabled:bg-gray-300 hover:bg-brand-dark transition-colors"
                            aria-label="Envoyer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AIAssistant;