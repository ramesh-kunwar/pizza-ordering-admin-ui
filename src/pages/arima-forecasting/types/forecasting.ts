// Core time series data structures
export interface TimeSeriesDataPoint {
  date: Date;
  timestamp: number;
  value: number;
  label: string;
}

export interface ProcessedDataset {
  timeSeries: TimeSeriesDataPoint[];
  additionalSeries?: { [field: string]: TimeSeriesDataPoint[] };
  summary: {
    totalRecords: number;
    startDate: Date;
    endDate: Date;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    missingValues: number;
    meanValue: number;
    minValue: number;
    maxValue: number;
  };
  aggregationType: 'sum' | 'mean' | 'count';
  valueField: string;
  additionalFields?: string[];
}

// File upload states
export interface FileUploadState {
  file: File | null;
  isUploading: boolean;
  progress: number;
  error: string | null;
  preview: any[];
}

// EDA (Exploratory Data Analysis) results
export interface EDAResults {
  descriptiveStats: {
    mean: number;
    std: number;
    min: number;
    max: number;
    median: number;
    q1: number;
    q3: number;
    skewness: number;
    kurtosis: number;
  };
  
  timeSeriesFeatures: {
    trend: 'increasing' | 'decreasing' | 'stable';
    seasonality: {
      detected: boolean;
      period?: number;
      strength?: number;
    };
    stationarity: {
      isStationary: boolean;
      adfPValue: number;
      recommendation: string;
    };
  };
  
  outliers: {
    indices: number[];
    values: number[];
    method: 'iqr' | 'zscore';
    threshold: number;
  };
  
  autocorrelation: {
    values: number[];
    significantLags: number[];
    ljungBoxPValue: number;
  };
}

// ARIMA model parameters and configuration
export interface ARIMAParams {
  p: number; // autoregressive order
  d: number; // differencing order
  q: number; // moving average order
}

export interface ModelConfig {
  params: ARIMAParams;
  trainTestSplit: number;
  forecastHorizon: number;
  confidenceLevel: number;
  maxIterations: number;
  tolerance: number;
}

// Training states
export interface ModelTrainingState {
  isTraining: boolean;
  progress: number;
  stage: 'preprocessing' | 'parameter_estimation' | 'training' | 'validation' | 'completed' | 'error';
  error: string | null;
  currentModel: string | null;
}

// Trained model results
export interface TrainedModel {
  id: string;
  name: string;
  type: string;
  params: ARIMAParams;
  coefficients?: number[];
  residuals: number[];
  fitted: number[];
  aic: number;
  bic: number;
  logLikelihood: number;
  trainedAt: Date;
  trainingTime: number;
  convergenceStatus: 'converged' | 'failed' | 'partial';
  validationMetrics?: ValidationMetrics;
}

// Forecast results
export interface ValidationMetrics {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
  aic: number;
  bic: number;
  residualStats: {
    mean: number;
    std: number;
    ljungBoxPValue: number;
  };
}

export interface ForecastResult {
  modelId: string;
  predictions: TimeSeriesDataPoint[];
  confidenceIntervals: {
    lower: number[];
    upper: number[];
  };
  forecastOrigin: Date;
  horizon: number;
  metrics: ValidationMetrics;
}

// Form and utility types
export interface RawDataRow {
  [key: string]: any;
}

export interface FieldData {
  name: string[];
  value: any;
  touched?: boolean;
  validating?: boolean;
  errors?: string[];
}
