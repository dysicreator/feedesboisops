
import { Vente, AllData } from '../types';
import { formatDateForInput } from './dateUtils';

// Extend the window object to avoid TS errors for jsPDF
declare global {
  interface Window {
    jspdf: any;
  }
}

const addInvoiceHeader = (doc: any, type: 'proforma' | 'commercial', vente: Vente, allData: AllData) => {
    const { companyInfoData } = allData;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Logo
    if (companyInfoData.logoBase64) {
        const img = new Image();
        img.src = companyInfoData.logoBase64;
        const ratio = img.width / img.height;
        const logoHeight = 25;
        const logoWidth = logoHeight * ratio;
        try {
            doc.addImage(companyInfoData.logoBase64, 'PNG', 14, 15, logoWidth, logoHeight);
        } catch(e) {
            console.error("Error adding logo to PDF", (e as Error).message);
        }
    }
    
    // Company Info
    doc.setFontSize(9);
    doc.setTextColor(100);
    const companyInfoX = companyInfoData.logoBase64 ? 55 : 14;
    doc.setFont("helvetica", "bold");
    doc.text(companyInfoData.name, companyInfoX, 20);
    doc.setFont("helvetica", "normal");
    let yPos = 25;
    if (companyInfoData.address) {
        doc.text(companyInfoData.address, companyInfoX, yPos, { maxWidth: 60 });
        yPos += (doc.getTextDimensions(companyInfoData.address, { maxWidth: 60 }).h) + 2;
    }
    if (companyInfoData.phone) doc.text(`Tél: ${companyInfoData.phone}`, companyInfoX, yPos);
    if (companyInfoData.email) doc.text(`Email: ${companyInfoData.email}`, companyInfoX, yPos + 4);
    if (companyInfoData.website) doc.text(`Web: ${companyInfoData.website}`, companyInfoX, yPos + 8);
    if (companyInfoData.taxId) doc.text(`${companyInfoData.taxId}`, companyInfoX, yPos + 12);

    // Invoice Title
    const title = type === 'proforma' ? 'FACTURE PROFORMA' : 'FACTURE';
    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text(title, pageWidth - 14, 25, { align: 'right' });
    
    doc.setFontSize(10);
    doc.text(`Numéro : ${vente.invoiceNumber}`, pageWidth - 14, 35, { align: 'right' });
    doc.text(`Date : ${formatDateForInput(vente.dateVente)}`, pageWidth - 14, 40, { align: 'right' });

    return 75; // Return Y position for next content
};

const addClientInfo = (doc: any, vente: Vente, y: number) => {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Facturé à :', 14, y);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(vente.client || 'Client non spécifié', 14, y + 6);
    if(vente.clientDetails) {
        doc.setFontSize(10);
        doc.text(vente.clientDetails, 14, y + 12, { maxWidth: 90 });
    }
    return y + 30;
};

const addInvoiceTable = (doc: any, vente: Vente, allData: AllData, y: number) => {
    const { autoTable } = window.jspdf;
    
    const lot = allData.lotsFabricationData.find(l => l.id === vente.lotFabricationId);
    
    const tableData = [[
        `${vente.nomProduitVendu || 'Produit'}\nLot: ${lot?.lotNumeroProduitFini || 'N/A'}`,
        vente.quantiteVendue,
        (vente.prixVenteUnitaire || 0).toFixed(2) + ' CAD',
        (vente.prixVenteTotal || 0).toFixed(2) + ' CAD'
    ]];

    autoTable(doc, {
        startY: y,
        head: [['Description', 'Quantité', 'Prix Unitaire', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [6, 78, 59] }, // Brand Dark
        styles: {cellPadding: 3, fontSize: 10}
    });
    
    const finalY = (doc as any).lastAutoTable.finalY;

    // Totals
    const rightAlignX = doc.internal.pageSize.getWidth() - 14;
    doc.setFontSize(10);
    doc.text(`Sous-total HT:`, 140, finalY + 10, { align: 'right' });
    doc.text(`${(vente.prixVenteTotal || 0).toFixed(2)} CAD`, rightAlignX, finalY + 10, { align: 'right' });
    doc.text(`Taxes:`, 140, finalY + 16, { align: 'right' });
    doc.text(`N/A`, rightAlignX, finalY + 16, { align: 'right' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL:`, 140, finalY + 24, { align: 'right' });
    doc.text(`${(vente.prixVenteTotal || 0).toFixed(2)} CAD`, rightAlignX, finalY + 24, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    
    return finalY + 30;
};

const addInvoiceFooter = (doc: any, vente: Vente, allData: AllData) => {
    const { companyInfoData } = allData;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = pageHeight - 50;
    
    if (vente.paymentTerms) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Conditions de paiement:', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(vente.paymentTerms, 14, y + 5, { maxWidth: 180 });
        y += 15;
    }
    
    if (companyInfoData.bankDetails) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(companyInfoData.bankDetails, 14, y);
    }
    
    if (companyInfoData.invoiceFooterText) {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(companyInfoData.invoiceFooterText, doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' });
    }
};

export const generateInvoicePdf = (type: 'proforma' | 'commercial', vente: Vente, allData: AllData) => {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        alert("Erreur: La librairie PDF n'est pas chargée.");
        return;
    }
    const doc = new jsPDF();
    
    let y = addInvoiceHeader(doc, type, vente, allData);
    y = addClientInfo(doc, vente, y);
    y = addInvoiceTable(doc, vente, allData, y);
    addInvoiceFooter(doc, vente, allData);

    doc.save(`${type === 'proforma' ? 'PROFORMA' : 'FACTURE'}-${vente.invoiceNumber}.pdf`);
};