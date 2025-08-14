/**
 * TypeScript interfaces for ARIMA Forecasting System
 * Final Year Project - Type Definitions
 */

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface UploadedDataset {
  filename: string;
  totalRecords: number;
  dateColumn: string;
  valueColumn: string;
  dateRange: {
    start: string;
    end: string;
  };
  preview: TimeSeriesDataPoint[];
}

export interface ARIMAOrder {
  p: number; // Autoregressive order
  d: number; // Differencing order
  q: number; // Moving average order
}

export interface TrainingConfig {
  dateColumn: string;
  valueColumn: string;
  testSize: number; // 0.0 to 1.0
  forecastHorizon: number;
  autoSelectOrder?: boolean;
  manualOrder?: ARIMAOrder;
}

export interface StationarityTest {
  is_stationary: boolean;
  adf_statistic: number;
  p_value: number;
  critical_values: Record<string, number>;
  interpretation: string;
}

export interface ModelParameters {
  ar_params: number[];
  ma_params: number[];
  sigma2: number;
}

export interface ResidualStats {
  mean: number;
  std: number;
  skewness: number;
  kurtosis: number;
}

export interface DataSummary {
  mean: number;
  std: number;
  min: number;
  max: number;
  data_points: number;
}

export interface TrainingResult {
  order: ARIMAOrder;
  aic: number;
  bic: number;
  log_likelihood: number;
  stationarity_test: StationarityTest;
  model_params: ModelParameters;
  residual_stats: ResidualStats;
  training_date: string;
  data_summary: DataSummary;
}

export interface ConfidenceInterval {
  lower: number[];
  upper: number[];
  confidence_level: number;
}

export interface ForecastResult {
  predictions: number[];
  confidence_intervals: ConfidenceInterval;
  dates: string[];
  forecast_info: {
    steps: number;
    model_order: ARIMAOrder;
    forecast_date: string;
  };
}

export interface PerformanceMetrics {
  mae: number;
  mse: number;
  rmse: number;
  mape?: number;
  r2: number;
  mean_actual: number;
  mean_predicted: number;
  directional_accuracy: number;
  sample_size: number;
}

export interface TrainingSession {
  session_id: string;
  filename: string;
  upload_time: string;
  data_info: {
    total_records: number;
    train_size: number;
    test_size: number;
    date_range: {
      start: string;
      end: string;
    };
  };
  model_info: TrainingResult;
  test_forecast: {
    dates: string[];
    actual_values: number[];
    predicted_values: number[];
    confidence_intervals: ConfidenceInterval;
  };
  future_forecast: ForecastResult;
  performance_metrics: PerformanceMetrics;
  forecast_horizon: number;
}

export interface APIResponse<T = any> {
  session_id?: string;
  status: 'success' | 'error';
  message?: string;
  data?: T;
  error?: string;
}

export interface SessionSummary {
  session_id: string;
  filename: string;
  upload_time: string;
  total_records: number;
  performance_metrics: PerformanceMetrics;
}

export interface BackendStatus {
  status: 'online' | 'offline' | 'loading';
  message?: string;
  version?: string;
}

// Chart data interfaces for visualization
export interface ChartDataPoint {
  date: string;
  actual?: number;
  predicted?: number;
  forecast?: number;
  lowerCI?: number;
  upperCI?: number;
  type: 'train' | 'test' | 'forecast';
}

// Component state interfaces
export interface UploadState {
  uploading: boolean;
  uploaded: boolean;
  dataset: UploadedDataset | null;
  error: string | null;
}

export interface TrainingState {
  training: boolean;
  completed: boolean;
  session: TrainingSession | null;
  error: string | null;
  progress: number;
}

export interface ForecastState {
  generating: boolean;
  results: ForecastResult | null;
  error: string | null;
}
