import { useState, useEffect } from 'react';
import { StorageKey } from '../types';

function useLocalStorage<T,>(storageKey: StorageKey, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const getStoredValue = (): T => {
    try {
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${storageKey}":`, (error as Error).message);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(getStoredValue);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${storageKey}":`, (error as Error).message);
    }
  }, [storageKey, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
