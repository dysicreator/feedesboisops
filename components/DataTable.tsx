import React, { useState, useMemo } from 'react';
import { Identifiable, ColumnDefinition, AllData } from '../types';
import { PencilIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, DocumentDuplicateIcon, MagnifyingGlassIcon } from './Icons';

interface DataTableProps<T extends Identifiable> {
  data: T[];
  columns: ColumnDefinition<T>[];
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  onClone?: (item: T) => void;
  showSearch?: boolean; // New prop to control search visibility, default true
  renderActions?: (item: T) => React.ReactNode;
  allData?: AllData;
}

type SortConfig<T> = {
  key: keyof T | null;
  direction: 'ascending' | 'descending';
} | null;

const DataTable = <T extends Identifiable,>(props: DataTableProps<T>): React.ReactNode => {
  const { data, columns, onEdit, onDelete, onClone, showSearch = true, renderActions, allData } = props;
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return data.filter(item => {
      return columns.some(col => {
        let valueToSearch: string | undefined = undefined;
        if (col.getSearchValue) {
          valueToSearch = col.getSearchValue(item, allData);
        } else if (typeof col.accessor === 'string' && item.hasOwnProperty(col.accessor)) {
          const rawValue = item[col.accessor as keyof T];
          if (rawValue !== null && rawValue !== undefined) {
            valueToSearch = String(rawValue);
          }
        }
        // For function accessors without getSearchValue, they are not easily searchable by default
        // unless their output is a simple string/number.
        // We could try to render col.accessor(item) and stringify, but it might be complex ReactNode.
        // So, for now, rely on getSearchValue for complex columns.
        return valueToSearch ? valueToSearch.toLowerCase().includes(lowerSearchTerm) : false;
      });
    });
  }, [data, columns, searchTerm, allData]);

  const sortedData = React.useMemo(() => {
    let sortableItems = [...filteredData]; // Sort the filtered data
    if (sortConfig !== null && sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key: keyof T) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof T) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronUpIcon className="w-4 h-4 text-gray-400 inline-block ml-1 invisible group-hover:visible" />;
    }
    return sortConfig.direction === 'ascending' ? 
      <ChevronUpIcon className="w-4 h-4 inline-block ml-1" /> : 
      <ChevronDownIcon className="w-4 h-4 inline-block ml-1" />;
  };

  return (
    <div className="bg-white shadow-md rounded-lg">
      {showSearch && (
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              placeholder="Rechercher dans la table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm"
            />
          </div>
        </div>
      )}
      {sortedData.length === 0 ? (
         <p className="text-gray-500 italic py-6 px-4 text-center">
            {searchTerm ? `Aucun résultat trouvé pour "${searchTerm}".` : "Aucune donnée disponible."}
         </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group cursor-pointer"
                    onClick={() => typeof col.accessor === 'string' ? requestSort(col.accessor as keyof T) : undefined}
                  >
                    {col.Header}
                    {typeof col.accessor === 'string' && getSortIcon(col.accessor as keyof T)}
                  </th>
                ))}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  {columns.map((col, index) => (
                    <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {col.cell 
                        ? col.cell(item, allData) 
                        : typeof col.accessor === 'function' 
                          ? col.accessor(item, allData) 
                          : String(item[col.accessor as keyof T] ?? '')}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {renderActions ? renderActions(item) : (
                      <div className="flex items-center justify-end space-x-2">
                        {onClone && (
                          <button
                            onClick={() => onClone(item)}
                            className="text-sky-600 hover:text-sky-800 transition-colors p-1"
                            title="Cloner"
                          >
                            <DocumentDuplicateIcon className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(item)}
                          className="text-brand-primary hover:text-brand-dark transition-colors p-1"
                          title="Modifier"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DataTable;