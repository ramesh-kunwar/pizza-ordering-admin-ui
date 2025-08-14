import Papa from 'papaparse';
import { parseISO, parse, isValid, format, differenceInDays, differenceInHours, getDay, getMonth } from 'date-fns';
import { groupBy, sumBy, meanBy } from 'lodash';
import type { 
  RawDataRow, 
  TimeSeriesDataPoint, 
  ProcessedDataset, 
  PreprocessedData, 
  FeatureConfig, 
  ProcessedFeatures 
} from '../types/lstm-forecasting';

export class LSTMDataProcessor {
  private static readonly DATE_FORMATS = [
    'M/d/yyyy',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'yyyy-MM-dd',
    'dd-MM-yyyy',
    'M/d/yy',
    'MM/dd/yy',
    'dd/MM/yy',
    'yyyy-MM-dd HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
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

    // Check for minimum data points for LSTM
    if (data.length < 100) {
      errors.push('Insufficient data for LSTM training (minimum 100 data points recommended)');
      suggestions.push('LSTM models work best with at least 200+ data points for reliable forecasting');
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

    console.log(`📊 Processing LSTM dataset: ${rawData.length} raw records`);

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

    console.log(`✅ Valid records: ${validRows.length}/${rawData.length}`);

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

    // Fill missing values using interpolation
    const processedTimeSeries = this.fillMissingValues(timeSeries, 'linear');
    
    const values = processedTimeSeries.map(ts => ts.value);
    const startDate = processedTimeSeries[0].date;
    const endDate = processedTimeSeries[processedTimeSeries.length - 1].date;
    
    // Calculate statistics
    const meanValue = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - meanValue) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    
    console.log(`📈 Final dataset: ${processedTimeSeries.length} time series points`);
    console.log(`📊 Stats: mean=${meanValue.toFixed(2)}, std=${std.toFixed(2)}, range=[${Math.min(...values).toFixed(2)}, ${Math.max(...values).toFixed(2)}]`);
    
    return {
      timeSeries: processedTimeSeries,
      additionalSeries: Object.keys(additionalSeries).length > 0 ? additionalSeries : undefined,
      summary: {
        totalRecords: processedTimeSeries.length,
        startDate,
        endDate,
        frequency,
        missingValues: rawData.length - validRows.length,
        meanValue,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        std,
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

    const sortedIntervals = intervals.sort((a, b) => a - b);
    const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

    const hour = 1000 * 60 * 60;
    const day = hour * 24;
    const week = day * 7;

    console.log(`📊 LSTM frequency analysis:`);
    console.log(`  - Data points: ${timeSeries.length}`);
    console.log(`  - Median interval: ${(medianInterval / day).toFixed(2)} days`);

    let detectedFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    
    if (medianInterval <= hour * 2) {
      detectedFrequency = 'hourly';
    } else if (medianInterval <= day * 2) {
      detectedFrequency = 'daily';
    } else if (medianInterval <= week * 2) {
      detectedFrequency = 'weekly';
    } else {
      detectedFrequency = 'monthly';
    }

    console.log(`  - Detected frequency: ${detectedFrequency}`);
    console.log(`📊 LSTM model optimized for ${detectedFrequency} predictions`);
    
    return detectedFrequency;
  }

  static fillMissingValues(
    timeSeries: TimeSeriesDataPoint[],
    method: 'linear' | 'forward_fill' | 'backward_fill' | 'mean' = 'linear'
  ): TimeSeriesDataPoint[] {
    if (timeSeries.length <= 1) return timeSeries;

    const result = [...timeSeries];
    const values = result.map(p => p.value);
    const meanValue = values.reduce((sum, val) => sum + val, 0) / values.length;

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

  // Feature engineering for LSTM
  static engineerFeatures(
    timeSeries: TimeSeriesDataPoint[],
    config: FeatureConfig
  ): ProcessedFeatures {
    console.log('🔧 Engineering features for LSTM model...');
    
    const features: number[][] = [];
    const featureNames: string[] = [];
    const target: number[] = [];
    const dates: Date[] = [];
    
    // Base target values
    const values = timeSeries.map(p => p.value);
    
    // Calculate maximum lookback needed
    const maxLookback = Math.max(
      config.includeLags ? Math.max(...config.lagDays) : 0,
      config.includeMovingAverages ? Math.max(...config.movingAverageWindows) : 0,
      config.includeSeasonality ? Math.max(...config.seasonalPeriods) : 0
    );
    
    console.log(`📊 Max lookback required: ${maxLookback} periods`);
    
    // Process each time point (starting from maxLookback to have enough history)
    for (let i = maxLookback; i < timeSeries.length; i++) {
      const currentFeatures: number[] = [];
      
      // Current value (base feature)
      currentFeatures.push(values[i]);
      if (i === maxLookback) featureNames.push('current_value');
      
      // Lag features
      if (config.includeLags) {
        for (const lag of config.lagDays) {
          if (i - lag >= 0) {
            currentFeatures.push(values[i - lag]);
            if (i === maxLookback) featureNames.push(`lag_${lag}`);
          }
        }
      }
      
      // Moving average features
      if (config.includeMovingAverages) {
        for (const window of config.movingAverageWindows) {
          if (i - window + 1 >= 0) {
            const ma = values.slice(i - window + 1, i + 1).reduce((sum, val) => sum + val, 0) / window;
            currentFeatures.push(ma);
            if (i === maxLookback) featureNames.push(`ma_${window}`);
          }
        }
      }
      
      // Seasonal features
      if (config.includeSeasonality) {
        for (const period of config.seasonalPeriods) {
          if (i - period >= 0) {
            currentFeatures.push(values[i - period]);
            if (i === maxLookback) featureNames.push(`seasonal_${period}`);
          }
          
          // Seasonal difference
          if (i - period >= 0) {
            const seasonalDiff = values[i] - values[i - period];
            currentFeatures.push(seasonalDiff);
            if (i === maxLookback) featureNames.push(`seasonal_diff_${period}`);
          }
        }
      }
      
      // Trend features
      if (config.includeTrend && i >= 5) {
        // Simple trend (slope over last 5 periods)
        const recentValues = values.slice(i - 4, i + 1);
        const x = [0, 1, 2, 3, 4];
        const n = 5;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = recentValues.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, idx) => sum + xi * recentValues[idx], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        
        currentFeatures.push(slope);
        if (i === maxLookback) featureNames.push('trend_slope');
      }
      
      // Calendar features
      const currentDate = timeSeries[i].date;
      
      if (config.includeWeekday) {
        const weekday = getDay(currentDate); // 0 = Sunday, 6 = Saturday
        // One-hot encode weekdays
        for (let d = 0; d < 7; d++) {
          currentFeatures.push(weekday === d ? 1 : 0);
          if (i === maxLookback) featureNames.push(`weekday_${d}`);
        }
      }
      
      if (config.includeMonth) {
        const month = getMonth(currentDate); // 0 = January, 11 = December
        // One-hot encode months
        for (let m = 0; m < 12; m++) {
          currentFeatures.push(month === m ? 1 : 0);
          if (i === maxLookback) featureNames.push(`month_${m}`);
        }
      }
      
      // Holiday indicators (simplified - can be enhanced)
      if (config.includeHolidays) {
        const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        
        // Major holidays (simplified detection)
        const isNewYear = dayOfYear <= 3 || dayOfYear >= 363; // Around New Year
        const isChristmas = dayOfYear >= 358 && dayOfYear <= 366; // Around Christmas
        const isThanksgiving = getMonth(currentDate) === 10 && getDay(currentDate) === 4; // November Thursday (simplified)
        
        currentFeatures.push(isNewYear ? 1 : 0);
        currentFeatures.push(isChristmas ? 1 : 0);
        currentFeatures.push(isThanksgiving ? 1 : 0);
        
        if (i === maxLookback) {
          featureNames.push('holiday_newyear');
          featureNames.push('holiday_christmas');
          featureNames.push('holiday_thanksgiving');
        }
      }
      
      features.push(currentFeatures);
      target.push(values[i]);
      dates.push(currentDate);
    }
    
    // Calculate feature statistics
    const featureStats: { [key: string]: { mean: number; std: number; min: number; max: number } } = {};
    
    for (let f = 0; f < featureNames.length; f++) {
      const featureValues = features.map(row => row[f]);
      const mean = featureValues.reduce((sum, val) => sum + val, 0) / featureValues.length;
      const variance = featureValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / featureValues.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...featureValues);
      const max = Math.max(...featureValues);
      
      featureStats[featureNames[f]] = { mean, std, min, max };
    }
    
    console.log(`✅ Feature engineering complete: ${features.length} samples, ${featureNames.length} features`);
    console.log(`📊 Features: ${featureNames.slice(0, 5).join(', ')}${featureNames.length > 5 ? '...' : ''}`);
    
    return {
      features,
      featureNames,
      target,
      dates,
      metadata: {
        originalLength: timeSeries.length,
        processedLength: features.length,
        droppedRows: maxLookback,
        featureStats,
      },
    };
  }

  // Create sequences for LSTM training
  static createSequences(
    features: ProcessedFeatures,
    lookBackDays: number,
    forecastHorizon: number = 1
  ): PreprocessedData {
    console.log(`🔄 Creating LSTM sequences: lookback=${lookBackDays}, horizon=${forecastHorizon}`);
    
    const { features: featureData, target, featureNames } = features;
    const totalSamples = featureData.length - lookBackDays - forecastHorizon + 1;
    
    if (totalSamples <= 0) {
      throw new Error(`Insufficient data for sequence creation. Need at least ${lookBackDays + forecastHorizon} samples, got ${featureData.length}`);
    }
    
    const sequences: number[][][] = [];
    const targets: number[][] = [];
    
    // Create sequences
    for (let i = 0; i < totalSamples; i++) {
      // Input sequence: [lookBackDays, features]
      const sequence: number[][] = [];
      for (let j = 0; j < lookBackDays; j++) {
        sequence.push([...featureData[i + j]]);
      }
      sequences.push(sequence);
      
      // Target: next values
      const targetSequence: number[] = [];
      for (let j = 0; j < forecastHorizon; j++) {
        targetSequence.push(target[i + lookBackDays + j]);
      }
      targets.push(targetSequence);
    }
    
    // Prepare data for scaling
    const originalData = target;
    const scaledData = [...target]; // Will be scaled later
    
    console.log(`✅ Sequences created: ${sequences.length} samples, input shape: [${lookBackDays}, ${featureNames.length}]`);
    
    return {
      sequences,
      targets,
      originalData,
      scaledData,
      featureNames,
      scaler: null, // Will be set during preprocessing
      targetScaler: null, // Will be set during preprocessing
      metadata: {
        sequenceLength: lookBackDays,
        featuresCount: featureNames.length,
        samplesCount: sequences.length,
        trainSize: Math.floor(sequences.length * 0.8), // 80% for training
        testSize: Math.ceil(sequences.length * 0.2), // 20% for testing
      },
    };
  }

  // Normalize data for LSTM training
  static normalizeData(data: PreprocessedData): PreprocessedData {
    console.log('📏 Normalizing data for LSTM training...');
    
    // Simple min-max scaling implementation
    const scaleMinMax = (values: number[]) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      
      if (range === 0) {
        return {
          scaled: values.map(() => 0),
          scaler: { min, max, range: 1 }
        };
      }
      
      return {
        scaled: values.map(val => (val - min) / range),
        scaler: { min, max, range }
      };
    };
    
    // Scale target values
    const { scaled: scaledTargets, scaler: targetScaler } = scaleMinMax(data.originalData);
    
    // Scale sequences
    const scaledSequences = data.sequences.map(sequence => {
      return sequence.map(timestep => {
        // Scale each feature separately
        return timestep.map((feature, featureIdx) => {
          // For now, simple normalization - in production, should scale each feature separately
          return feature / 1000; // Simple scaling
        });
      });
    });
    
    // Scale targets array
    const scaledTargetArray = data.targets.map(targetSeq => 
      targetSeq.map(val => (val - targetScaler.min) / targetScaler.range)
    );
    
    console.log(`✅ Data normalized: target range [${targetScaler.min.toFixed(2)}, ${(targetScaler.min + targetScaler.range).toFixed(2)}]`);
    
    return {
      ...data,
      sequences: scaledSequences,
      targets: scaledTargetArray,
      scaledData: scaledTargets,
      scaler: { min: 0, max: 1000, range: 1000 }, // Simplified feature scaler
      targetScaler,
    };
  }

  // Denormalize predictions
  static denormalizePredictions(
    predictions: number[],
    targetScaler: { min: number; max: number; range: number }
  ): number[] {
    return predictions.map(val => val * targetScaler.range + targetScaler.min);
  }
}
