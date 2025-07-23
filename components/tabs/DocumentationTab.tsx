
import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const DocumentationTab: React.FC = () => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/documentation.md')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur réseau: Impossible de charger le fichier (statut ${response.status})`);
        }
        return response.text();
      })
      .then(text => {
        setMarkdownContent(text);
        setError(null);
      })
      .catch(err => {
        console.error("Erreur lors du chargement de la documentation:", { message: (err as Error).message });
        setError("Impossible de charger la documentation. Veuillez vérifier que le fichier 'documentation.md' est présent et accessible.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (markdownContent) {
      let isMounted = true;
      const parseMarkdown = async () => {
        const rawHtml = await marked.parse(markdownContent);
        if (isMounted) {
          setHtmlContent(DOMPurify.sanitize(rawHtml));
        }
      };
      parseMarkdown();
      return () => {
        isMounted = false;
      };
    } else {
        setHtmlContent('');
    }
  }, [markdownContent]);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md">
      {isLoading && (
        <div className="text-center text-gray-500">
          <p>Chargement de la documentation...</p>
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg">
          <h3 className="font-semibold">Erreur</h3>
          <p>{error}</p>
        </div>
      )}
      {!isLoading && !error && (
        <article
          className="prose prose-lg prose-emerald max-w-none 
            text-gray-700
            prose-p:leading-relaxed
            prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:text-brand-dark prose-h1:border-b-2 prose-h1:border-brand-primary/20 prose-h1:pb-4 prose-h1:mb-6
            prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-brand-primary prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2
            prose-h3:text-xl prose-h3:font-semibold prose-h3:text-brand-dark prose-h3:mt-8 prose-h3:mb-3
            prose-a:text-brand-primary hover:prose-a:text-brand-dark prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
            prose-ul:list-disc prose-ul:pl-5
            prose-li:my-2 prose-li:marker:text-brand-primary
            prose-strong:text-brand-dark prose-strong:font-bold
            prose-code:bg-emerald-50 prose-code:text-emerald-900 prose-code:font-mono prose-code:text-sm prose-code:px-2 prose-code:py-1 prose-code:rounded-lg prose-code:border prose-code:border-emerald-200
            prose-blockquote:border-l-4 prose-blockquote:border-brand-secondary prose-blockquote:bg-amber-50/50 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:my-6 prose-blockquote:text-gray-800 prose-blockquote:not-italic prose-blockquote:shadow-sm prose-blockquote:rounded-r-lg
            prose-hr:border-gray-300 prose-hr:my-12"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )}
    </div>
  );
};

export default DocumentationTab;
