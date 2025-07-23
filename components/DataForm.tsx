import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Identifiable, FormFieldConfig, FormFieldOption, AllData,
    DynamicEntityType, AutoFillConfig, IngredientAchete, ParametreItem
} from '../types';
import { PlusIcon, TrashIcon } from './Icons';
import { formatDateForInput } from '../utils/dateUtils';
import { generateId } from '../utils/idUtils';


interface DataFormProps<T extends Identifiable> {
  formConfig: FormFieldConfig<T>[];
  initialData?: Partial<T>;
  onSubmit: (data: Partial<T>) => void;
  onCancel: () => void;
  isEditMode: boolean;
  allData: AllData; // New prop to pass in all application data context
}

const DataForm = <T extends Identifiable,>(props: DataFormProps<T>): React.ReactNode => {
  const { formConfig, initialData, onSubmit, onCancel, isEditMode, allData } = props;

  const [formData, setFormData] = useState<Partial<T>>(() => initialData || {});

  useEffect(() => {
    let currentFormData: Partial<T> = initialData ? { ...initialData } : {};
    formConfig.forEach(field => {
      if (field.type === 'readonly_calculated' && field.calculationFn) {
        (currentFormData as any)[field.name as string] = field.calculationFn(currentFormData, allData);
      }
      if (field.type === 'date' && currentFormData[field.name as keyof T]) {
         (currentFormData as any)[field.name as string] = formatDateForInput(currentFormData[field.name as keyof T] as string);
      }
      if (field.type === 'nested_list_stub' && !currentFormData[field.name as keyof T]) {
        (currentFormData as any)[field.name as string] = [];
      }
    });
    setFormData(currentFormData);
  }, [initialData, formConfig, allData, isEditMode]);


  useEffect(() => {
    let changed = false;
    const newFormData: Partial<T> = { ...formData };
    formConfig.forEach(field => {
      if (field.type === 'readonly_calculated' && field.calculationFn && field.dependsOn?.some(dep => newFormData.hasOwnProperty(dep))) {
        const calculatedValue = field.calculationFn(newFormData, allData);
        if (newFormData[field.name as keyof T] !== calculatedValue) {
          (newFormData as any)[field.name as string] = calculatedValue;
          changed = true;
        }
      }
    });
    if (changed) {
      setFormData(newFormData);
    }
  }, [formData, formConfig, allData]);


  const getDynamicOptions = useCallback((fieldConfig: FormFieldConfig<T>, currentItemData?: any): FormFieldOption[] => {
    let baseDynamicEntityType = fieldConfig.dynamicEntityType;
    const formDataSource = currentItemData || formData; 

    if (fieldConfig.filterContextField && formDataSource[fieldConfig.filterContextField as keyof T]) {
        const contextValue = formDataSource[fieldConfig.filterContextField as keyof T];
        if (fieldConfig.name === 'componentGenericId') { 
            if (contextValue === 'IngredientGenerique') baseDynamicEntityType = 'ingredientsAchetesNomsUniques';
            else if (contextValue === 'PlanteCultureBase') baseDynamicEntityType = 'parametresCultureBase';
        } else if (fieldConfig.name === 'lotUtiliseId') { 
            if (contextValue === 'IngredientAchete') baseDynamicEntityType = 'ingredientsAchetes';
            else if (contextValue === 'PlanteCultivee') baseDynamicEntityType = 'recoltes'; 
        } else if (fieldConfig.name === 'lotEntrantId') { 
            if (contextValue === 'Recolte') baseDynamicEntityType = 'recoltes';
            else if (contextValue === 'EtapeTransformationPrecedente') baseDynamicEntityType = 'etapesTransformation';
        }
    }
    
    if (!baseDynamicEntityType) return fieldConfig.options || []; 
    
    let entities: (Identifiable | { name: string, value: string | number })[] = [];
    if (baseDynamicEntityType === 'ingredientsAchetesNomsUniques') {
        const uniqueNoms = Array.from(new Set(allData.ingredientsAchetesData.map(ing => ing.nom))).filter(Boolean);
        return uniqueNoms.map(nom => ({ value: nom, label: nom }));
    } else if (baseDynamicEntityType === 'conditionnementsNomsUniques') {
        const uniqueNoms = Array.from(new Set(allData.conditionnementsData.map(cond => cond.nom))).filter(Boolean);
        return uniqueNoms.map(nom => ({ value: nom, label: nom }));
    } else if (baseDynamicEntityType === 'intrantsAgricolesNomsUniques') {
        const uniqueNoms = Array.from(new Set(allData.intrantsAgricolesData.map(intr => intr.nom))).filter(Boolean);
        return uniqueNoms.map(nom => ({ value: nom, label: nom }));
    } else if (baseDynamicEntityType === 'parametresCultureBase') {
        entities = (allData.parametresData || []).filter(p => p.type === 'cultureBase');
    } else if (baseDynamicEntityType === 'parametresIngredientGeneriqueRef') {
        entities = (allData.parametresData || []).filter(p => p.type === 'ingredientGeneriqueRef');
    } else if (baseDynamicEntityType === 'parametresConditionnementRef') {
        entities = (allData.parametresData || []).filter(p => p.type === 'conditionnementRef');
    } else if (baseDynamicEntityType === 'parametresIntrantAgricoleRef') {
        entities = (allData.parametresData || []).filter(p => p.type === 'intrantAgricoleRef');
    } else if (baseDynamicEntityType === 'parametresUniteMesure') { 
        entities = (allData.parametresData || []).filter(p => p.type === 'uniteMesure');
        return entities
            .filter(entity => (entity as ParametreItem).valeur != null && (entity as ParametreItem).nom != null)
            .map(entity => ({
                value: (entity as ParametreItem).valeur as string | number, 
                label: (entity as ParametreItem).nom, 
            }));
    } else {
        const entityDataKey = `${baseDynamicEntityType}Data` as keyof AllData;
        entities = (allData[entityDataKey] as Identifiable[]) || [];
    }
    
    if (baseDynamicEntityType === 'ingredientsAchetes' && fieldConfig.name !== 'nomIngredient') { 
        entities = (entities as IngredientAchete[]).filter(ing => ing.quantiteRestante > 0 || ing.id === formDataSource['lotUtiliseId']);
    }

    if (fieldConfig.secondaryFilter) {
        entities = entities.filter(entity => fieldConfig.secondaryFilter!(entity, formDataSource, allData));
    }

    // Defensive filtering to prevent crashes from malformed data (e.g., null/undefined value or label)
    return entities
        .filter(entity => {
            if (!entity) return false;
            const valueField = fieldConfig.valueFieldForDynamicOptions || 'id';
            const value = (entity as any)[valueField];

            let label;
            if (typeof fieldConfig.labelFieldForDynamicOptions === 'function') {
                label = fieldConfig.labelFieldForDynamicOptions(entity, allData);
            } else {
                const labelField = fieldConfig.labelFieldForDynamicOptions || 'nom';
                label = (entity as any)[labelField];
            }
            return value != null && label != null;
        })
        .map(entity => ({
            value: (entity as any)[fieldConfig.valueFieldForDynamicOptions || 'id'],
            label: typeof fieldConfig.labelFieldForDynamicOptions === 'function'
                    ? fieldConfig.labelFieldForDynamicOptions(entity, allData)
                    : (entity as any)[fieldConfig.labelFieldForDynamicOptions || 'nom'],
        }));
  }, [allData, formData]);


  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, fieldConfig: FormFieldConfig<T>, listIndex?: number, subFieldName?: string) => {
    const { name, value, type } = e.target;
    const fieldName = fieldConfig.name;

    let processedValue: any = value;
    if (type === 'number') {
      processedValue = value === '' ? undefined : parseFloat(value);
    } else if (type === 'checkbox') {
       processedValue = (e.target as HTMLInputElement).checked;
    }
    
    setFormData(prev => {
      const newState: Partial<T> = { ...prev };
      let currentItemForAutofill: any = newState;
      let actualDynamicEntityType = fieldConfig.dynamicEntityType; 

      if (typeof listIndex === 'number' && subFieldName) {
        const list = (newState[fieldName as keyof T] as any[] || []).map(item => ({...item}));
        if (list[listIndex]) {
          list[listIndex][subFieldName] = processedValue;
          currentItemForAutofill = list[listIndex];
          
          if (fieldConfig.filterContextField && currentItemForAutofill[fieldConfig.filterContextField]) {
            const contextValue = currentItemForAutofill[fieldConfig.filterContextField];
             if (subFieldName === 'componentGenericId') { 
                if (contextValue === 'IngredientGenerique') actualDynamicEntityType = 'ingredientsAchetesNomsUniques';
                else if (contextValue === 'PlanteCultureBase') actualDynamicEntityType = 'parametresCultureBase';
            } else if (subFieldName === 'lotUtiliseId') { 
                if (contextValue === 'IngredientAchete') actualDynamicEntityType = 'ingredientsAchetes';
                else if (contextValue === 'PlanteCultivee') actualDynamicEntityType = 'recoltes'; 
            } else if (subFieldName === 'lotEntrantId') { 
                if (contextValue === 'Recolte') actualDynamicEntityType = 'recoltes';
                else if (contextValue === 'EtapeTransformationPrecedente') actualDynamicEntityType = 'etapesTransformation';
            }
          }
        }
        (newState as any)[fieldName as string] = list;
      } else {
        (newState as any)[fieldName as string] = processedValue;
        
        if (fieldConfig.filterContextField && newState[fieldConfig.filterContextField as keyof T]) {
            const contextValue = newState[fieldConfig.filterContextField as keyof T];
            if (fieldName === 'lotEntrantId') { 
                if (contextValue === 'Recolte') actualDynamicEntityType = 'recoltes';
                else if (contextValue === 'EtapeTransformationPrecedente') actualDynamicEntityType = 'etapesTransformation';
            }
        }
      }

      if (fieldConfig.type === 'select' && fieldConfig.autoFillFields) {
        let sourceEntities: Identifiable[] = [];
        let selectedEntity: Identifiable | undefined = undefined;
        
        
        if(actualDynamicEntityType === 'ingredientsAchetesNomsUniques'){
            const uniqueNoms = Array.from(new Set(allData.ingredientsAchetesData.map(ing => ing.nom)));
            const foundNom = uniqueNoms.find(nom => nom === processedValue);
            if (foundNom) selectedEntity = { id: foundNom, nom: foundNom } as any; 
        } else if (actualDynamicEntityType === 'parametresCultureBase') {
            sourceEntities = (allData.parametresData || []).filter(p => p.type === 'cultureBase');
            selectedEntity = sourceEntities.find(entity => String(entity[fieldConfig.valueFieldForDynamicOptions || 'id' as keyof typeof entity]) === String(processedValue));
        } else if (actualDynamicEntityType === 'parametresUniteMesure') {
            sourceEntities = (allData.parametresData || []).filter(p => p.type === 'uniteMesure');
            selectedEntity = sourceEntities.find(entity => String((entity as ParametreItem).valeur) === String(processedValue));
        } else if (actualDynamicEntityType) {
            const entityDataKey = `${actualDynamicEntityType}Data` as keyof AllData;
            sourceEntities = (allData[entityDataKey] as Identifiable[]) || [];
            selectedEntity = sourceEntities.find(entity => String(entity[fieldConfig.valueFieldForDynamicOptions || 'id' as keyof typeof entity]) === String(processedValue));
        }


        if (selectedEntity) {
          fieldConfig.autoFillFields.forEach((afConfig: AutoFillConfig<any>) => {
            const sourceValue = typeof afConfig.sourceField === 'function'
                                ? afConfig.sourceField(selectedEntity, allData) 
                                : selectedEntity![afConfig.sourceField as keyof typeof selectedEntity];

            if (typeof listIndex === 'number' && subFieldName) {
                const list = (newState[fieldName as keyof T] as any[] || []);
                 if (list[listIndex] && Object.keys(list[listIndex]).includes(afConfig.targetFormField)) {
                    list[listIndex][afConfig.targetFormField] = sourceValue;
                 }
            } else {
                 (newState as any)[afConfig.targetFormField] = sourceValue;
            }
          });
        }
      }
      return newState;
    });
  }, [allData]);

  const handleAddItemToList = (fieldName: keyof T, defaultItem?: any | ((formData: Partial<T>) => any)) => {
    setFormData(prev => {
      const currentList = (prev[fieldName] as any[] || []);
      let newItem: any;
      if (typeof defaultItem === 'function') {
        newItem = { ...defaultItem(prev), _tempId: generateId('formItem') };
      } else {
        newItem = defaultItem ? { ...defaultItem, _tempId: generateId('formItem') } : { _tempId: generateId('formItem') };
      }
      return { ...prev, [fieldName]: [...currentList, newItem] };
    });
  };

  const handleRemoveItemFromList = (fieldName: keyof T, itemIndex: number) => {
    setFormData(prev => {
      const currentList = (prev[fieldName] as any[] || []);
      return { ...prev, [fieldName]: currentList.filter((_, idx) => idx !== itemIndex) };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalFormData: Partial<T> = { ...formData };
    formConfig.forEach(field => {
      if (field.type === 'number' && (finalFormData[field.name as keyof T] === '' || finalFormData[field.name as keyof T] === undefined)) {
         delete finalFormData[field.name as keyof T];
      }
      if (field.type === 'nested_list_stub' && Array.isArray(finalFormData[field.name as keyof T])) {
        (finalFormData[field.name as keyof T] as any[]) = (finalFormData[field.name as keyof T] as any[]).map(item => {
          if (item && typeof item === 'object' && '_tempId' in item) {
            const { _tempId, ...rest } = item;
            return rest;
          }
          return item;
        });
      }
      if (field.type === 'readonly_calculated') {
         delete finalFormData[field.name as keyof T];
      }
    });
    onSubmit(finalFormData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formConfig.map(field => {
        const fieldNameStr = String(field.name);
        const isDisabled = field.disabled || (isEditMode && field.name === 'id');

        if (field.type === 'readonly_calculated') {
          return (
            <div key={fieldNameStr}>
              <label htmlFor={fieldNameStr} className="block text-sm font-medium text-gray-700 mb-1">
                {field.label} (Calculé)
              </label>
              <input
                type="text"
                id={fieldNameStr}
                name={fieldNameStr}
                value={(formData[field.name as keyof T] || '').toString()}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700 sm:text-sm p-2"
                readOnly
                disabled
              />
            </div>
          );
        }
        return (
        <div key={fieldNameStr}>
          <label htmlFor={fieldNameStr} className="block text-sm font-medium text-gray-700 mb-1">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              id={fieldNameStr}
              name={fieldNameStr}
              value={(formData[field.name as keyof T] || '').toString()}
              onChange={(e) => handleChange(e, field, undefined, undefined)}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2 bg-white text-gray-900 placeholder-gray-500"
              placeholder={field.placeholder}
              required={field.required}
              disabled={isDisabled}
            />
          ) : field.type === 'select' ? (
            <select
              id={fieldNameStr}
              name={fieldNameStr}
              value={(formData[field.name as keyof T] || '').toString()}
              onChange={(e) => handleChange(e, field, undefined, undefined)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2.5 pr-8 bg-white text-gray-900"
              required={field.required}
              disabled={isDisabled}
            >
              <option value="">{field.placeholder || `Sélectionner ${field.label.toLowerCase()}`}</option>
              {getDynamicOptions(field).map((option: FormFieldOption) => (
                <option key={option.value.toString()} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : field.type === 'checkbox' ? (
             <input
                type="checkbox"
                id={fieldNameStr}
                name={fieldNameStr}
                checked={Boolean(formData[field.name as keyof T]) || false}
                onChange={(e) => handleChange(e, field, undefined, undefined)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                disabled={isDisabled}
             />
          ) : field.type === 'multiselect_stub' ? (
             <div>
                <input
                  type="text"
                  id={fieldNameStr}
                  name={fieldNameStr}
                  value={Array.isArray(formData[field.name as keyof T]) ? (formData[field.name as keyof T] as string[]).join(', ') : (formData[field.name as keyof T] || '').toString()}
                  onChange={(e) => {
                    const value = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                    setFormData(prev => ({ ...prev, [field.name]: value as any }));
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2 bg-white text-gray-900 placeholder-gray-500"
                  placeholder={field.placeholder || "Valeurs séparées par des virgules"}
                  required={field.required}
                  disabled={isDisabled}
                />
                <p className="mt-1 text-xs text-gray-500">{field.placeholder || "Entrez les valeurs séparées par des virgules (ex: ID1, ID2)"}</p>
             </div>
          ) : field.type === 'nested_list_stub' ? (
            <div className="space-y-3 p-3 border border-gray-200 rounded-md">
              {(formData[field.name as keyof T] as any[] || []).map((item: any, index: number) => (
                <div key={item?._tempId || index} className="p-3 border bg-gray-50 border-gray-200 rounded space-y-2 relative">
                  {field.subFormConfig?.map(subField => {
                     const subFieldNameStr = `${fieldNameStr}-${index}-${String(subField.name)}`;
                     const subFieldIsDisabled = subField.disabled || (isEditMode && subField.name === 'id'); 

                     if (subField.type === 'readonly_calculated') {
                        const calculatedValue = subField.calculationFn ? subField.calculationFn(item, allData) : (item[subField.name as keyof typeof item] || '');
                        return (
                            <div key={subFieldNameStr}>
                                <label htmlFor={subFieldNameStr} className="text-xs font-medium text-gray-600">{subField.label} (Calculé)</label>
                                <input
                                    type="text"
                                    id={subFieldNameStr}
                                    value={(calculatedValue || '').toString()}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 text-gray-700 sm:text-sm p-1.5"
                                    readOnly
                                    disabled
                                />
                            </div>
                        );
                     }
                    return (
                    <div key={subFieldNameStr}>
                      <label htmlFor={subFieldNameStr} className="text-xs font-medium text-gray-600">{subField.label} {subField.required && <span className="text-red-500">*</span>}</label>
                      {subField.type === 'select' ? (
                        <select
                            id={subFieldNameStr}
                            name={String(subField.name)} 
                            value={(item[subField.name as keyof typeof item] || '').toString()}
                            onChange={(e) => handleChange(e, field, index, String(subField.name))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-1.5 bg-white text-gray-900"
                            required={subField.required}
                            disabled={subFieldIsDisabled}
                        >
                            <option value="">{subField.placeholder || `Sélectionner`}</option>
                            {getDynamicOptions(subField as FormFieldConfig<any>, item).map(option => (
                                <option key={option.value.toString()} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                      ) : (
                        <input
                            type={subField.type === 'number' ? 'number' : subField.type === 'date' ? 'date' : 'text'}
                            id={subFieldNameStr}
                            name={String(subField.name)}
                            value={(item[subField.name as keyof typeof item] || '').toString()}
                            onChange={(e) => handleChange(e, field, index, String(subField.name))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-1.5 bg-white text-gray-900 placeholder-gray-500"
                            placeholder={subField.placeholder}
                            required={subField.required}
                            disabled={subFieldIsDisabled}
                            step={subField.type === 'number' ? (subField.step || 'any') : undefined}
                        />
                      )}
                    </div>
                  )})}
                  <button
                    type="button"
                    onClick={() => handleRemoveItemFromList(field.name as keyof T, index)}
                    className="absolute top-1 right-1 text-red-500 hover:text-red-700 p-0.5 bg-white rounded-full shadow"
                    title="Supprimer élément"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => handleAddItemToList(field.name as keyof T, field.defaultItem)}
                className="mt-2 flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300"
              >
                <PlusIcon className="w-4 h-4 mr-1" /> Ajouter à "{field.label}"
              </button>
              {field.placeholder && <p className="mt-1 text-xs text-gray-500">{field.placeholder}</p>}
            </div>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              id={fieldNameStr}
              name={fieldNameStr}
              value={(formData[field.name as keyof T] || '').toString()}
              onChange={(e) => handleChange(e, field, undefined, undefined)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm p-2 bg-white text-gray-900 placeholder-gray-500"
              placeholder={field.placeholder}
              required={field.required}
              disabled={isDisabled}
              step={field.type === 'number' ? (field.step || 'any') : undefined}
            />
          )}
        </div>
      )})}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary"
        >
          Annuler
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-brand-primary border border-transparent rounded-md shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
        >
          {isEditMode ? 'Enregistrer les modifications' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
};

export default DataForm;