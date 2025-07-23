
export const generateId = (prefix?: string): string => {
  const randomSuffix = Math.random().toString(36).substr(2, 9);
  const timestamp = Date.now().toString(36);
  if (prefix) {
    return `${prefix.toUpperCase()}-${timestamp}-${randomSuffix}`;
  }
  return `${timestamp}-${randomSuffix}`;
};
