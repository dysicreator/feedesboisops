// This file acts as a barrel for commonly used utility functions.

export { 
    formatDateForInput, 
    isDateApproaching 
} from './dateUtils';

export { 
    calculateIntrantAgricoleCoutUnitaire,
    calculateCultureCost,
    calculateRecolteCost,
    calculateLotFabricationCost,
    calculateEtapeTransformationCost,
    calculateVenteDetails,
    calculateKpiSet
} from './calculationUtils';

export { 
    logActivity,
    exportAllDataAsJSON,
    importAllDataFromJSON,
    sanitizeForJSON
} from './storageUtils';

export { 
    getAllInventoryAlerts 
} from './alertUtils';

export {
    generateSalesPdfReport,
    generateIngredientStockStatusPdf,
    generatePackagingStockStatusPdf,
    generateFinishedGoodsStockStatusPdf,
    generateProductionLotsPdf,
    generateHarvestsPdf,
    generateTransformationsPdf,
    generateGeneralActivityOverviewPdf,
    generateTraceabilityReportPdf
} from './reportUtils';

export { 
    generateInvoicePdf
} from './invoiceUtils';


export { 
    manageLotFabricationStockOnSave,
    manageLotFabricationStockOnDelete,
    manageRecolteStockOnSave,
    manageRecolteStockOnDelete,
    manageVenteStockOnSave,
    manageVenteStockOnDelete,
} from './stockManager';


export { generateId } from './idUtils';