/**
 * Data Preprocessing Utilities
 * Handles client-side data aggregation to prevent backend overload
 */

export interface RawDataRow {
  [key: string]: string | number;
}

export interface AggregatedDataRow {
  date: string;
  value: number;
}

export interface PreprocessingResult {
  aggregatedData: AggregatedDataRow[];
  originalRowCount: number;
  aggregatedRowCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  aggregationType: 'daily' | 'none';
}

/**
 * Detects if the dataset needs aggregation based on size and date patterns
 */
export function shouldAggregateData(data: RawDataRow[], dateColumn: string): boolean {
  // If more than 1000 rows, check for multiple entries per day
  if (data.length > 1000) {
    const dateCounts: { [key: string]: number } = {};
    
    // Sample first 100 rows to check for duplicates
    const sampleSize = Math.min(100, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const dateValue = data[i][dateColumn];
      if (dateValue) {
        const dateStr = formatDateForComparison(dateValue.toString());
        dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
      }
    }
    
    // If we find multiple entries for the same date, aggregation is needed
    const duplicateDates = Object.values(dateCounts).filter(count => count > 1);
    return duplicateDates.length > 0;
  }
  
  return false;
}

/**
 * Aggregates raw transaction data into daily totals
 */
export function aggregateDataByDay(
  data: RawDataRow[], 
  dateColumn: string, 
  valueColumn: string
): PreprocessingResult {
  const dailyTotals: { [key: string]: number } = {};
  const validRows: RawDataRow[] = [];
  
  // Process each row
  data.forEach((row, index) => {
    const dateValue = row[dateColumn];
    const numericValue = parseFloat(row[valueColumn]?.toString() || '0');
    
    if (dateValue && !isNaN(numericValue)) {
      const dateStr = formatDateForComparison(dateValue.toString());
      if (dateStr) {
        dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + numericValue;
        validRows.push(row);
      }
    }
  });
  
  // Convert to array format
  const aggregatedData: AggregatedDataRow[] = Object.entries(dailyTotals)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const dates = aggregatedData.map(row => row.date);
  
  return {
    aggregatedData,
    originalRowCount: data.length,
    aggregatedRowCount: aggregatedData.length,
    dateRange: {
      start: dates[0] || '',
      end: dates[dates.length - 1] || '',
    },
    aggregationType: aggregatedData.length < data.length ? 'daily' : 'none',
  };
}

/**
 * Formats date strings for consistent comparison
 */
function formatDateForComparison(dateString: string): string | null {
  try {
    // Handle common date formats
    let date: Date;
    
    // Try parsing as-is first
    date = new Date(dateString);
    
    // If invalid, try common formats
    if (isNaN(date.getTime())) {
      // Handle MM/DD/YYYY format
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          // Assume MM/DD/YYYY
          date = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        }
      }
      // Handle DD-MM-YYYY format
      else if (dateString.includes('-') && dateString.length === 10) {
        date = new Date(dateString);
      }
    }
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    // Return YYYY-MM-DD format
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

/**
 * Converts aggregated data to CSV format for backend upload
 */
export function convertToCSV(aggregatedData: AggregatedDataRow[]): string {
  const headers = ['date', 'value'];
  const csvRows = [
    headers.join(','),
    ...aggregatedData.map(row => `${row.date},${row.value}`)
  ];
  
  return csvRows.join('\n');
}

/**
 * Creates a downloadable Blob from aggregated data
 */
export function createAggregatedCSVFile(
  aggregatedData: AggregatedDataRow[], 
  originalFilename: string
): File {
  const csvContent = convertToCSV(aggregatedData);
  const blob = new Blob([csvContent], { type: 'text/csv' });
  
  // Generate new filename
  const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
  const newFilename = `${nameWithoutExt}_daily_aggregated.csv`;
  
  return new File([blob], newFilename, { type: 'text/csv' });
}

/**
 * Validates that aggregation was successful
 */
export function validateAggregation(result: PreprocessingResult): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check minimum data points
  if (result.aggregatedRowCount < 30) {
    errors.push(`Insufficient data: Only ${result.aggregatedRowCount} days of data. Minimum 30 days recommended.`);
  } else if (result.aggregatedRowCount < 100) {
    warnings.push(`Limited data: Only ${result.aggregatedRowCount} days. 100+ days recommended for better accuracy.`);
  }
  
  // Check aggregation effectiveness
  const reductionRatio = result.originalRowCount / result.aggregatedRowCount;
  if (reductionRatio > 100) {
    warnings.push(`High aggregation ratio: ${reductionRatio.toFixed(1)}x reduction. Verify data quality.`);
  }
  
  // Check date range
  const startDate = new Date(result.dateRange.start);
  const endDate = new Date(result.dateRange.end);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff !== result.aggregatedRowCount - 1) {
    warnings.push('Date gaps detected in the data. Some days may be missing.');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
