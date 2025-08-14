// Core time series data structures (reusing similar structure from ARIMA)
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
    std: number;
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

// LSTM-specific model parameters
export interface LSTMParams {
  lookBackDays: number; // Number of previous days to look at (sequence length)
  epochs: number; // Training epochs
  batchSize: number; // Batch size for training
  learningRate: number; // Learning rate for optimizer
  hiddenUnits: number; // Number of LSTM units
  dropout: number; // Dropout rate for regularization
  layers: number; // Number of LSTM layers
  validationSplit: number; // Validation data split ratio
}

export interface LSTMModelConfig {
  params: LSTMParams;
  forecastHorizon: number; // Number of days to forecast
  confidenceLevel: number; // Confidence level for prediction intervals
  scaleData: boolean; // Whether to normalize/scale data
  includeSeasonality: boolean; // Whether to include seasonal features
  includeExternalFeatures: boolean; // Whether to include additional features
}

// Training states
export interface ModelTrainingState {
  isTraining: boolean;
  progress: number;
  epoch: number;
  totalEpochs: number;
  stage: 'preprocessing' | 'training' | 'validation' | 'completed' | 'error';
  error: string | null;
  currentLoss: number | null;
  validationLoss: number | null;
  metrics: {
    trainLoss: number[];
    valLoss: number[];
    epochs: number[];
  };
}

// Trained model results
export interface TrainedLSTMModel {
  id: string;
  name: string;
  type: 'LSTM';
  params: LSTMParams;
  modelArchitecture: {
    inputShape: number[];
    outputShape: number[];
    totalParams: number;
    trainableParams: number;
  };
  trainingHistory: {
    loss: number[];
    valLoss: number[];
    epochs: number[];
    bestEpoch: number;
    bestValLoss: number;
  };
  trainedAt: Date;
  trainingTime: number;
  convergenceStatus: 'converged' | 'early_stopped' | 'completed' | 'failed';
  validationMetrics: ValidationMetrics;
  scalers?: {
    feature: any; // MinMaxScaler parameters
    target: any; // Target scaler parameters
  };
}

// Forecast results
export interface ValidationMetrics {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
  mse: number; // Mean Squared Error
  directionalAccuracy: number; // Percentage of correct direction predictions
  residualStats: {
    mean: number;
    std: number;
    skewness: number;
    kurtosis: number;
  };
}

export interface LSTMForecastResult {
  modelId: string;
  predictions: TimeSeriesDataPoint[];
  confidenceIntervals: {
    lower: number[];
    upper: number[];
  };
  forecastOrigin: Date;
  horizon: number;
  metrics: ValidationMetrics;
  modelConfidence: number; // Overall model confidence score
  featureImportance?: { [feature: string]: number };
}

// Data preprocessing types
export interface PreprocessedData {
  sequences: number[][][]; // [samples, timesteps, features]
  targets: number[][]; // Target values
  originalData: number[];
  scaledData: number[];
  featureNames: string[];
  scaler: any; // MinMaxScaler instance
  targetScaler: any; // Target scaler instance
  metadata: {
    sequenceLength: number;
    featuresCount: number;
    samplesCount: number;
    trainSize: number;
    testSize: number;
  };
}

// Feature engineering types
export interface FeatureConfig {
  includeLags: boolean;
  lagDays: number[];
  includeMovingAverages: boolean;
  movingAverageWindows: number[];
  includeSeasonality: boolean;
  seasonalPeriods: number[];
  includeTrend: boolean;
  includeWeekday: boolean;
  includeMonth: boolean;
  includeHolidays: boolean;
  customFeatures?: string[];
}

export interface ProcessedFeatures {
  features: number[][];
  featureNames: string[];
  target: number[];
  dates: Date[];
  metadata: {
    originalLength: number;
    processedLength: number;
    droppedRows: number;
    featureStats: { [key: string]: { mean: number; std: number; min: number; max: number } };
  };
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

// Dashboard state types
export interface LSTMDashboardState {
  activeTab: 'upload' | 'preprocessing' | 'modeling' | 'forecast' | 'analysis';
  dataset: ProcessedDataset | null;
  preprocessedData: PreprocessedData | null;
  trainedModel: TrainedLSTMModel | null;
  forecast: LSTMForecastResult | null;
  isLoaded: boolean;
}

// Model comparison types
export interface ModelComparison {
  models: TrainedLSTMModel[];
  metrics: {
    [modelId: string]: ValidationMetrics;
  };
  bestModel: string;
  comparison: {
    metric: keyof ValidationMetrics;
    values: { [modelId: string]: number };
    winner: string;
  }[];
}
