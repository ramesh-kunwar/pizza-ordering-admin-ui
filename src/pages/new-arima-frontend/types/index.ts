/**
 * Type definitions for New ARIMA Forecasting Dashboard
 */

export interface ForecastData {
  date: string;
  actual?: number;
  predicted: number;
  lower_ci: number;
  upper_ci: number;
  type: 'historical' | 'forecast';
}

export interface PerformanceMetrics {
  mae: number;
  mse: number;
  rmse: number;
  mape: number;
  r2: number;
  directional_accuracy: number;
  mean_actual: number;
  mean_predicted: number;
  sample_size: number;
}

export interface ModelInfo {
  order: {
    p: number;
    d: number;
    q: number;
  };
  aic: number;
  bic: number;
  log_likelihood: number;
  stationarity_test: {
    is_stationary: boolean;
    adf_statistic: number;
    p_value: number;
    interpretation: string;
  };
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
  model_info: ModelInfo;
  performance_metrics: PerformanceMetrics;
  test_forecast: {
    dates: string[];
    actual_values: number[];
    predicted_values: number[];
    confidence_intervals: {
      lower: number[];
      upper: number[];
      confidence_level: number;
    };
  };
  future_forecast: {
    predictions: number[];
    confidence_intervals: {
      lower: number[];
      upper: number[];
      confidence_level: number;
    };
    dates: string[];
  };
  forecast_horizon: number;
}

export interface SessionSummary {
  session_id: string;
  filename: string;
  upload_time: string;
  total_records: number;
  performance_metrics: PerformanceMetrics;
  model_order: {
    p: number;
    d: number;
    q: number;
  };
}

export interface BackendStatus {
  status: 'online' | 'offline';
  message: string;
  version?: string;
}

export interface TrainingConfig {
  dateColumn: string;
  valueColumn: string;
  testSize: number;
  forecastHorizon: number;
}

export interface APIResponse<T> {
  status: 'success' | 'error';
  session_id?: string;
  message?: string;
  data?: T;
  error?: string;
}

export interface ForecastTableData {
  key: string;
  date: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  formatted_date: string;
}

export interface ChartDataPoint {
  date: string;
  actual?: number;
  predicted: number;
  lower_ci: number;
  upper_ci: number;
  timestamp: number;
}
