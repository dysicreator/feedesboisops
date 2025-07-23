
import React from 'react';
import { PlusIcon } from './Icons';

interface TabContentWrapperProps {
  title: string;
  onAddItem: () => void;
  children: React.ReactNode;
  addButtonLabel?: string;
}

const TabContentWrapper: React.FC<TabContentWrapperProps> = ({ title, onAddItem, children, addButtonLabel = "Add New Item" }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold text-brand-dark">{title}</h2>
        <button
          onClick={onAddItem}
          className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-md shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          {addButtonLabel}
        </button>
      </div>
      <div>{children}</div>
    </div>
  );
};

export default TabContentWrapper;
