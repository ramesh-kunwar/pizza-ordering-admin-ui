import Papa from 'papaparse';
import { parseISO, parse, isValid, format, differenceInDays, differenceInHours } from 'date-fns';
import { groupBy, sumBy, meanBy, countBy } from 'lodash';
import type { RawDataRow, TimeSeriesDataPoint, ProcessedDataset } from '../types/forecasting';
// import { RawDataRow, TimeSeriesDataPoint, ProcessedDataset } from '../types/forecasting';

export class DataProcessor {
  private static readonly DATE_FORMATS = [
    'M/d/yyyy',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'yyyy-MM-dd',
    'dd-MM-yyyy',
    'M/d/yy',
    'MM/dd/yy',
    'dd/MM/yy',
  ];

  static async parseCSV<T = any>(file: File): Promise<T[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<T>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim(),
        transform: (value) => (typeof value === 'string' ? value.trim() : value),
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(results.data);
          }
        },
        error: (error) => reject(error),
      });
    });
  }

  static parseDate(dateString: string, timeString?: string): Date | null {
    if (!dateString) return null;

    const combinedString = timeString ? `${dateString} ${timeString}` : dateString;
    
    const isoAttempt = parseISO(combinedString);
    if (isValid(isoAttempt)) return isoAttempt;

    for (const formatStr of this.DATE_FORMATS) {
      try {
        const timeFormat = timeString ? ' HH:mm:ss' : '';
        const parsed = parse(combinedString, formatStr + timeFormat, new Date());
        if (isValid(parsed)) return parsed;
      } catch {
        continue;
      }
    }

    try {
      const timestamp = Date.parse(combinedString);
      if (!isNaN(timestamp)) return new Date(timestamp);
    } catch {
      // Continue to null return
    }

    return null;
  }

  static validateDataset(data: any[]): { isValid: boolean; errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!data || data.length === 0) {
      errors.push('Dataset is empty');
      return { isValid: false, errors, suggestions };
    }

    const headers = Object.keys(data[0]);
    
    const dateFields = headers.filter(h => 
      h.toLowerCase().includes('date') || 
      h.toLowerCase().includes('time') || 
      h.toLowerCase().includes('timestamp')
    );

    if (dateFields.length === 0) {
      errors.push('No date/time columns detected');
      suggestions.push('Ensure your dataset has a column with "date", "time", or "timestamp" in the name');
    }

    const numericFields = headers.filter(h => {
      const sample = data.slice(0, 10).map(row => row[h]).filter(v => v != null);
      return sample.length > 0 && sample.every(v => !isNaN(Number(v)));
    });

    if (numericFields.length === 0) {
      errors.push('No numeric columns detected for forecasting');
      suggestions.push('Ensure your dataset has at least one numeric column (price, quantity, etc.)');
    }

    const sampleSize = Math.min(100, data.length);
    const dateParsingSuccess = dateFields.map(field => {
      const parsed = data.slice(0, sampleSize)
        .map(row => this.parseDate(row[field]))
        .filter(d => d !== null);
      return { field, successRate: parsed.length / sampleSize };
    });

    const bestDateField = dateParsingSuccess.reduce((best, current) => 
      current.successRate > best.successRate ? current : best, 
      { field: '', successRate: 0 }
    );

    if (bestDateField.successRate < 0.8) {
      errors.push(`Date parsing success rate too low (${(bestDateField.successRate * 100).toFixed(1)}%)`);
      suggestions.push('Check date format. Supported formats: MM/dd/yyyy, dd/MM/yyyy, yyyy-MM-dd, etc.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions,
    };
  }

  static processTimeSeriesData(
    rawData: any[],
    options: {
      dateField: string;
      timeField?: string;
      valueField: string;
      aggregationType: 'sum' | 'mean' | 'count';
      frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
      additionalFields?: string[];
    }
  ): ProcessedDataset {
    const { dateField, timeField, valueField, aggregationType, frequency, additionalFields } = options;

    const validRows = rawData
      .map((row, index) => {
        const date = this.parseDate(row[dateField], timeField ? row[timeField] : undefined);
        const value = Number(row[valueField]);
        
        if (!date || isNaN(value)) return null;
        
        return {
          originalIndex: index,
          date,
          value,
          ...row,
        };
      })
      .filter(row => row !== null) as Array<{ date: Date; value: number; originalIndex: number; [key: string]: any }>;

    if (validRows.length === 0) {
      throw new Error('No valid data points found after processing');
    }

    const groupedData = this.groupByTimeFrequency(validRows, frequency);
    
    const timeSeries: TimeSeriesDataPoint[] = Object.entries(groupedData)
      .map(([dateStr, points]) => {
        const date = new Date(dateStr);
        let aggregatedValue: number;

        switch (aggregationType) {
          case 'sum':
            aggregatedValue = sumBy(points, 'value');
            break;
          case 'mean':
            aggregatedValue = meanBy(points, 'value');
            break;
          case 'count':
            aggregatedValue = points.length;
            break;
          default:
            aggregatedValue = sumBy(points, 'value');
        }

        return {
          date,
          timestamp: date.getTime(),
          value: aggregatedValue,
          label: format(date, frequency === 'hourly' ? 'MMM dd, HH:mm' : 'MMM dd, yyyy'),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const values = timeSeries.map(ts => ts.value);
    const startDate = timeSeries[0].date;
    const endDate = timeSeries[timeSeries.length - 1].date;

    // Process additional fields if specified
    const additionalSeries: { [field: string]: TimeSeriesDataPoint[] } = {};
    
    if (additionalFields && additionalFields.length > 0) {
      for (const field of additionalFields) {
        const fieldGroupedData = this.groupByTimeFrequency(
          validRows.filter(row => !isNaN(Number(row[field]))),
          frequency
        );
        
        const fieldTimeSeries: TimeSeriesDataPoint[] = Object.entries(fieldGroupedData)
          .map(([dateStr, points]) => {
            const date = new Date(dateStr);
            let aggregatedValue: number;

            switch (aggregationType) {
              case 'sum':
                aggregatedValue = sumBy(points, field);
                break;
              case 'mean':
                aggregatedValue = meanBy(points, field);
                break;
              case 'count':
                aggregatedValue = points.length;
                break;
              default:
                aggregatedValue = sumBy(points, field);
            }

            return {
              date,
              timestamp: date.getTime(),
              value: aggregatedValue,
              label: format(date, frequency === 'hourly' ? 'MMM dd, HH:mm' : 'MMM dd, yyyy'),
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        additionalSeries[field] = fieldTimeSeries;
      }
    }

    const processedTimeSeries = this.fillMissingValues(timeSeries, 'linear');
    
    // For very large datasets, apply intelligent sampling to maintain performance
    const finalTimeSeries = this.applySamplingIfNeeded(processedTimeSeries, frequency);
    
    return {
      timeSeries: finalTimeSeries,
      additionalSeries: Object.keys(additionalSeries).length > 0 ? additionalSeries : undefined,
      summary: {
        totalRecords: processedTimeSeries.length,
        startDate,
        endDate,
        frequency,
        missingValues: rawData.length - validRows.length,
        meanValue: values.reduce((sum, v) => sum + v, 0) / values.length,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
      },
      aggregationType,
      valueField,
      additionalFields,
    };
  }

  private static groupByTimeFrequency(
    data: Array<{ date: Date; value: number; [key: string]: any }>,
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): Record<string, typeof data> {
    return groupBy(data, (row) => {
      const date = row.date;
      switch (frequency) {
        case 'hourly':
          return format(date, 'yyyy-MM-dd HH:00:00');
        case 'daily':
          return format(date, 'yyyy-MM-dd');
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return format(weekStart, 'yyyy-MM-dd');
        case 'monthly':
          return format(date, 'yyyy-MM-01');
        default:
          return format(date, 'yyyy-MM-dd');
      }
    });
  }

  static detectTimeFrequency(timeSeries: TimeSeriesDataPoint[]): 'hourly' | 'daily' | 'weekly' | 'monthly' {
    if (timeSeries.length < 2) return 'daily';

    const intervals = timeSeries.slice(1).map((point, index) => 
      point.timestamp - timeSeries[index].timestamp
    );

    const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];

    const hour = 1000 * 60 * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;

    if (medianInterval <= hour * 2) return 'hourly';
    if (medianInterval <= day * 2) return 'daily';
    if (medianInterval <= week * 2) return 'weekly';
    return 'monthly';
  }

  static fillMissingValues(
    timeSeries: TimeSeriesDataPoint[],
    method: 'linear' | 'forward_fill' | 'backward_fill' | 'mean' = 'linear'
  ): TimeSeriesDataPoint[] {
    if (timeSeries.length <= 1) return timeSeries;

    const result = [...timeSeries];
    const meanValue = timeSeries.reduce((sum, point) => sum + point.value, 0) / timeSeries.length;

    for (let i = 0; i < result.length; i++) {
      if (isNaN(result[i].value) || result[i].value === null || result[i].value === undefined) {
        switch (method) {
          case 'forward_fill':
            if (i > 0) result[i].value = result[i - 1].value;
            else result[i].value = meanValue;
            break;
          case 'backward_fill':
            const nextValid = result.slice(i + 1).find(p => !isNaN(p.value));
            result[i].value = nextValid ? nextValid.value : meanValue;
            break;
          case 'linear':
            const prevValid = result.slice(0, i).reverse().find(p => !isNaN(p.value));
            const nextValidLinear = result.slice(i + 1).find(p => !isNaN(p.value));
            if (prevValid && nextValidLinear) {
              const prevIndex = result.indexOf(prevValid);
              const nextIndex = result.indexOf(nextValidLinear);
              const ratio = (i - prevIndex) / (nextIndex - prevIndex);
              result[i].value = prevValid.value + ratio * (nextValidLinear.value - prevValid.value);
            } else {
              result[i].value = meanValue;
            }
            break;
          case 'mean':
          default:
            result[i].value = meanValue;
            break;
        }
      }
    }

    return result;
  }

  static detectOutliers(
    timeSeries: TimeSeriesDataPoint[],
    method: 'iqr' | 'zscore' = 'iqr',
    threshold: number = method === 'iqr' ? 1.5 : 3
  ): { indices: number[]; values: number[]; bounds?: { lower: number; upper: number } } {
    const values = timeSeries.map(point => point.value);
    const outlierIndices: number[] = [];
    const outlierValues: number[] = [];
    let bounds: { lower: number; upper: number } | undefined;

    if (method === 'iqr') {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - threshold * iqr;
      const upperBound = q3 + threshold * iqr;
      bounds = { lower: lowerBound, upper: upperBound };

      values.forEach((value, index) => {
        if (value < lowerBound || value > upperBound) {
          outlierIndices.push(index);
          outlierValues.push(value);
        }
      });
    } else if (method === 'zscore') {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const std = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      );

      values.forEach((value, index) => {
        const zscore = Math.abs(value - mean) / std;
        if (zscore > threshold) {
          outlierIndices.push(index);
          outlierValues.push(value);
        }
      });
    }

    return { indices: outlierIndices, values: outlierValues, bounds };
  }

  static applySamplingIfNeeded(
    timeSeries: TimeSeriesDataPoint[],
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): TimeSeriesDataPoint[] {
    const n = timeSeries.length;
    
    // Define optimal sizes for different frequencies
    const optimalSizes = {
      hourly: 2000,   // ~83 days of hourly data
      daily: 1000,    // ~2.7 years of daily data  
      weekly: 500,    // ~9.6 years of weekly data
      monthly: 300    // ~25 years of monthly data
    };
    
    const maxSize = optimalSizes[frequency];
    
    if (n <= maxSize) {
      return timeSeries; // No sampling needed
    }
    
    console.log(`📊 Large dataset detected (${n} points). Applying intelligent sampling to ${maxSize} points...`);
    
    // Use systematic sampling to maintain temporal structure
    const samplingRatio = maxSize / n;
    const sampledData: TimeSeriesDataPoint[] = [];
    
    // Always include the first and last points
    sampledData.push(timeSeries[0]);
    
    // Sample intermediate points systematically
    for (let i = 1; i < n - 1; i++) {
      const shouldInclude = Math.random() < samplingRatio || 
                          (i % Math.ceil(1 / samplingRatio) === 0);
      
      if (shouldInclude && sampledData.length < maxSize - 1) {
        sampledData.push(timeSeries[i]);
      }
    }
    
    // Always include the last point
    if (sampledData.length < maxSize) {
      sampledData.push(timeSeries[n - 1]);
    }
    
    // Sort by timestamp to maintain chronological order
    sampledData.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`✅ Sampling complete: ${n} → ${sampledData.length} points`);
    
    return sampledData;
  }
}
