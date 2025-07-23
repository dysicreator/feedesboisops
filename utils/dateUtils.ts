
export const formatDateForInput = (dateString?: string | null): string => {
  if (!dateString) return '';
  try {
    // Check if the dateString is already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const testDate = new Date(dateString);
        if (!isNaN(testDate.getTime())) return dateString; // It's a valid date in the correct format
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if invalid, or could return ''
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Error formatting date:", dateString, (e as Error).message);
    return dateString; // Or ''
  }
};

export const isDateApproaching = (dateString: string | undefined, daysInAdvance: number): boolean => {
  if (!dateString) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to midnight for consistent comparison
  const targetDate = new Date(dateString);
  if (isNaN(targetDate.getTime())) return false;
  targetDate.setHours(0,0,0,0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= daysInAdvance && diffDays >=0; // Alert if within X days AND not already passed
};