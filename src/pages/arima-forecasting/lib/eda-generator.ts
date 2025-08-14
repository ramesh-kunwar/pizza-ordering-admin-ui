import { mean, variance, standardDeviation, median, quantile } from 'simple-statistics';
// import { EDAResults, TimeSeriesDataPoint } from '../types/forecasting';
import type { EDAResults, TimeSeriesDataPoint } from '../types/forecasting';
import { DataProcessor } from './data-processor';

export class EDAGenerator {
  static generateEDAResults(timeSeries: TimeSeriesDataPoint[]): EDAResults {
    const values = timeSeries.map(point => point.value);
    
    if (values.length === 0) {
      throw new Error('No data available for EDA analysis');
    }

    // Descriptive Statistics
    const descriptiveStats = this.calculateDescriptiveStats(values);
    
    // Time Series Features
    const timeSeriesFeatures = this.analyzeTimeSeriesFeatures(values, timeSeries);
    
    // Outlier Detection
    const outliers = DataProcessor.detectOutliers(timeSeries, 'iqr', 1.5);
    
    // Autocorrelation Analysis
    const autocorrelation = this.calculateAutocorrelation(values);

    return {
      descriptiveStats,
      timeSeriesFeatures,
      outliers,
      autocorrelation
    };
  }

  private static calculateDescriptiveStats(values: number[]) {
    const sortedValues = [...values].sort((a, b) => a - b);
    
    return {
      mean: mean(values),
      std: standardDeviation(values),
      min: Math.min(...values),
      max: Math.max(...values),
      median: median(values),
      q1: quantile(sortedValues, 0.25),
      q3: quantile(sortedValues, 0.75),
      skewness: this.calculateSkewness(values),
      kurtosis: this.calculateKurtosis(values)
    };
  }

  private static calculateSkewness(values: number[]): number {
    const meanValue = mean(values);
    const stdValue = standardDeviation(values);
    const n = values.length;
    
    const skewness = values.reduce((sum, value) => {
      return sum + Math.pow((value - meanValue) / stdValue, 3);
    }, 0) / n;
    
    return skewness;
  }

  private static calculateKurtosis(values: number[]): number {
    const meanValue = mean(values);
    const stdValue = standardDeviation(values);
    const n = values.length;
    
    const kurtosis = values.reduce((sum, value) => {
      return sum + Math.pow((value - meanValue) / stdValue, 4);
    }, 0) / n - 3;
    
    return kurtosis;
  }

  private static analyzeTimeSeriesFeatures(values: number[], timeSeries: TimeSeriesDataPoint[]) {
    // Trend Analysis
    const trend = this.detectTrend(values);
    
    // Seasonality Analysis
    const seasonality = this.detectSeasonality(values);
    
    // Stationarity Test (simplified ADF test)
    const stationarity = this.testStationarity(values);

    return {
      trend,
      seasonality,
      stationarity
    };
  }

  private static detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable';
    
    // Simple linear regression to detect trend
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    const threshold = 0.01; // Adjust based on data scale
    if (Math.abs(slope) < threshold) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private static detectSeasonality(values: number[]): { detected: boolean; period?: number; strength?: number } {
    if (values.length < 12) {
      return { detected: false };
    }

    // Simple seasonal detection using autocorrelation
    const maxPeriod = Math.min(Math.floor(values.length / 3), 52); // Up to 52 periods
    let bestPeriod = 0;
    let maxCorrelation = 0;

    for (let period = 2; period <= maxPeriod; period++) {
      const correlation = this.calculateLaggedCorrelation(values, period);
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }

    const threshold = 0.3; // Correlation threshold for seasonality
    const detected = maxCorrelation > threshold;

    return {
      detected,
      period: detected ? bestPeriod : undefined,
      strength: detected ? maxCorrelation : undefined
    };
  }

  private static calculateLaggedCorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;

    const n = values.length - lag;
    const x = values.slice(0, n);
    const y = values.slice(lag);

    const meanX = mean(x);
    const meanY = mean(y);

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    const correlation = numerator / Math.sqrt(denomX * denomY);
    return isNaN(correlation) ? 0 : correlation;
  }

  private static testStationarity(values: number[]): { isStationary: boolean; adfPValue: number; recommendation: string } {
    // Simplified stationarity test - checking for unit root
    // This is a simplified version of the Augmented Dickey-Fuller test
    
    if (values.length < 10) {
      return {
        isStationary: false,
        adfPValue: 1.0,
        recommendation: 'Insufficient data for stationarity test'
      };
    }

    // Calculate first differences
    const differences = [];
    for (let i = 1; i < values.length; i++) {
      differences.push(values[i] - values[i - 1]);
    }

    // Test if the mean and variance are relatively stable
    const originalVariance = variance(values);
    const differenceVariance = variance(differences);
    
    // Simple heuristic: if differencing reduces variance significantly, likely non-stationary
    const varianceRatio = differenceVariance / originalVariance;
    
    // Check for mean reversion
    const meanValue = mean(values);
    let meanReversionCount = 0;
    for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      const next = values[i + 1];
      
      if ((prev - meanValue) * (next - meanValue) < 0) {
        meanReversionCount++;
      }
    }
    
    const meanReversionRatio = meanReversionCount / (values.length - 2);
    
    // Simple criteria for stationarity
    const isStationary = varianceRatio < 0.8 && meanReversionRatio > 0.3;
    
    // Simulate p-value based on our criteria
    const pValue = isStationary ? 0.01 : 0.15;
    
    const recommendation = isStationary 
      ? 'Series appears stationary (d=0)'
      : 'Consider differencing to achieve stationarity (d=1)';

    return {
      isStationary,
      adfPValue: pValue,
      recommendation
    };
  }

  private static calculateAutocorrelation(values: number[], maxLags: number = 20): { values: number[]; significantLags: number[]; ljungBoxPValue: number } {
    const autocorrelations: number[] = [];
    const significantLags: number[] = [];
    
    maxLags = Math.min(maxLags, Math.floor(values.length / 4));

    for (let lag = 0; lag <= maxLags; lag++) {
      const correlation = this.calculateLaggedCorrelation(values, lag);
      autocorrelations.push(correlation);
      
      // Check for significance (simplified)
      const criticalValue = 1.96 / Math.sqrt(values.length); // 95% confidence
      if (lag > 0 && Math.abs(correlation) > criticalValue) {
        significantLags.push(lag);
      }
    }

    // Simplified Ljung-Box test
    const ljungBoxPValue = this.ljungBoxTest(values, Math.min(10, maxLags));

    return {
      values: autocorrelations,
      significantLags,
      ljungBoxPValue
    };
  }

  private static ljungBoxTest(values: number[], lags: number): number {
    const n = values.length;
    if (n < lags + 1) return 1.0;

    let statistic = 0;
    const meanValue = mean(values);

    for (let lag = 1; lag <= lags; lag++) {
      const correlation = this.calculateLaggedCorrelation(values, lag);
      statistic += (correlation ** 2) / (n - lag);
    }

    statistic *= n * (n + 2);

    // Approximate p-value (simplified chi-square test)
    // In practice, you would use a proper chi-square distribution
    return statistic > 18.31 ? 0.01 : statistic > 15.51 ? 0.05 : statistic > 12.59 ? 0.1 : 0.5;
  }
}
