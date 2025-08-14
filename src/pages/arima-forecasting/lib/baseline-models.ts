import { mean } from 'simple-statistics';
import type { TimeSeriesDataPoint, TrainedModel, ForecastResult, ValidationMetrics } from '../types/forecasting';

export class BaselineModels {
  
  /**
   * Simple Moving Average Model
   */
  static createMovingAverage(window: number = 7): BaselineModel {
    return new MovingAverageModel(window);
  }

  /**
   * Exponential Smoothing Model
   */
  static createExponentialSmoothing(alpha: number = 0.3): BaselineModel {
    return new ExponentialSmoothingModel(alpha);
  }

  /**
   * Seasonal Naive Model
   */
  static createSeasonalNaive(seasonLength: number = 7): BaselineModel {
    return new SeasonalNaiveModel(seasonLength);
  }

  /**
   * Linear Trend Model
   */
  static createLinearTrend(): BaselineModel {
    return new LinearTrendModel();
  }
}

abstract class BaselineModel {
  protected originalData: number[] = [];
  protected fitted: number[] = [];
  protected residuals: number[] = [];

  abstract train(timeSeries: TimeSeriesDataPoint[]): Promise<TrainedModel>;
  abstract forecast(horizon: number): Promise<ForecastResult>;

  protected calculateMetrics(actual: number[], fitted: number[]): ValidationMetrics {
    const residuals = actual.map((val, i) => val - fitted[i]);
    const mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / residuals.length;
    const rmse = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length);
    
    const actualMean = mean(actual);
    const totalSumSquares = actual.reduce((sum, val) => sum + (val - actualMean) ** 2, 0);
    const residualSumSquares = residuals.reduce((sum, r) => sum + r * r, 0);
    
    let r2 = 0;
    if (totalSumSquares > 0) {
      r2 = Math.max(-5, 1 - (residualSumSquares / totalSumSquares));
    }
    
    let mapeSum = 0;
    let validCount = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (Math.abs(actual[i]) > 0.001) {
        const ape = Math.abs((actual[i] - fitted[i]) / actual[i]) * 100;
        if (ape < 1000) {
          mapeSum += ape;
          validCount++;
        }
      }
    }
    
    const mape = validCount > 0 ? mapeSum / validCount : 999;

    return {
      mae,
      rmse,
      mape: Math.min(mape, 999),
      r2,
      aic: Math.log(residualSumSquares / residuals.length) * residuals.length + 2 * 2, // Simple AIC
      bic: Math.log(residualSumSquares / residuals.length) * residuals.length + Math.log(residuals.length) * 2,
      residualStats: {
        mean: mean(residuals),
        std: Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length),
        ljungBoxPValue: 0.5
      }
    };
  }
}

class MovingAverageModel extends BaselineModel {
  constructor(private window: number) {
    super();
  }

  async train(timeSeries: TimeSeriesDataPoint[]): Promise<TrainedModel> {
    const startTime = Date.now();
    this.originalData = timeSeries.map(point => point.value);
    
    this.fitted = [];
    this.residuals = [];

    for (let i = 0; i < this.originalData.length; i++) {
      if (i < this.window) {
        // For initial points, use expanding mean
        const prediction = mean(this.originalData.slice(0, i + 1));
        this.fitted.push(prediction);
      } else {
        // Use moving average
        const prediction = mean(this.originalData.slice(i - this.window, i));
        this.fitted.push(prediction);
      }
      this.residuals.push(this.originalData[i] - this.fitted[i]);
    }

    const validationMetrics = this.calculateMetrics(this.originalData, this.fitted);

    return {
      id: `moving_avg_${this.window}_${Date.now()}`,
      name: `Moving Average (${this.window})`,
      type: 'MovingAverage' as any,
      params: { window: this.window } as any,
      coefficients: [this.window],
      residuals: this.residuals,
      fitted: this.fitted,
      aic: validationMetrics.aic,
      bic: validationMetrics.bic,
      logLikelihood: -validationMetrics.aic / 2,
      trainedAt: new Date(),
      trainingTime: Date.now() - startTime,
      convergenceStatus: 'converged',
      validationMetrics
    };
  }

  async forecast(horizon: number): Promise<ForecastResult> {
    const predictions: TimeSeriesDataPoint[] = [];
    let lastValues = this.originalData.slice(-this.window);
    
    for (let i = 1; i <= horizon; i++) {
      const prediction = mean(lastValues);
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        timestamp: Date.now() + i * 24 * 60 * 60 * 1000,
        value: Math.max(0, prediction),
        label: `Forecast ${i}`
      });
      
      // Update the window for next prediction
      lastValues = [...lastValues.slice(1), prediction];
    }

    const baseError = Math.sqrt(this.residuals.reduce((sum, r) => sum + r * r, 0) / this.residuals.length);
    const metrics = this.calculateMetrics(this.originalData, this.fitted);

    return {
      modelId: `moving_avg_${this.window}`,
      predictions,
      confidenceIntervals: {
        lower: predictions.map((_, i) => Math.max(0, predictions[i].value - 1.96 * baseError * Math.sqrt(i + 1))),
        upper: predictions.map((_, i) => predictions[i].value + 1.96 * baseError * Math.sqrt(i + 1))
      },
      forecastOrigin: new Date(),
      horizon,
      metrics
    };
  }
}

class ExponentialSmoothingModel extends BaselineModel {
  constructor(private alpha: number) {
    super();
  }

  async train(timeSeries: TimeSeriesDataPoint[]): Promise<TrainedModel> {
    const startTime = Date.now();
    this.originalData = timeSeries.map(point => point.value);
    
    this.fitted = [];
    this.residuals = [];

    let smoothedValue = this.originalData[0];
    this.fitted.push(smoothedValue);
    this.residuals.push(0);

    for (let i = 1; i < this.originalData.length; i++) {
      smoothedValue = this.alpha * this.originalData[i - 1] + (1 - this.alpha) * smoothedValue;
      this.fitted.push(smoothedValue);
      this.residuals.push(this.originalData[i] - smoothedValue);
    }

    const validationMetrics = this.calculateMetrics(this.originalData.slice(1), this.fitted.slice(1));

    return {
      id: `exp_smooth_${this.alpha}_${Date.now()}`,
      name: `Exponential Smoothing (α=${this.alpha})`,
      type: 'ExponentialSmoothing' as any,
      params: { alpha: this.alpha } as any,
      coefficients: [this.alpha],
      residuals: this.residuals,
      fitted: this.fitted,
      aic: validationMetrics.aic,
      bic: validationMetrics.bic,
      logLikelihood: -validationMetrics.aic / 2,
      trainedAt: new Date(),
      trainingTime: Date.now() - startTime,
      convergenceStatus: 'converged',
      validationMetrics
    };
  }

  async forecast(horizon: number): Promise<ForecastResult> {
    const predictions: TimeSeriesDataPoint[] = [];
    const lastSmoothedValue = this.fitted[this.fitted.length - 1];
    
    for (let i = 1; i <= horizon; i++) {
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        timestamp: Date.now() + i * 24 * 60 * 60 * 1000,
        value: Math.max(0, lastSmoothedValue),
        label: `Forecast ${i}`
      });
    }

    const baseError = Math.sqrt(this.residuals.slice(1).reduce((sum, r) => sum + r * r, 0) / (this.residuals.length - 1));
    const metrics = this.calculateMetrics(this.originalData.slice(1), this.fitted.slice(1));

    return {
      modelId: `exp_smooth_${this.alpha}`,
      predictions,
      confidenceIntervals: {
        lower: predictions.map((_, i) => Math.max(0, lastSmoothedValue - 1.96 * baseError * Math.sqrt(i + 1))),
        upper: predictions.map((_, i) => lastSmoothedValue + 1.96 * baseError * Math.sqrt(i + 1))
      },
      forecastOrigin: new Date(),
      horizon,
      metrics
    };
  }
}

class SeasonalNaiveModel extends BaselineModel {
  constructor(private seasonLength: number) {
    super();
  }

  async train(timeSeries: TimeSeriesDataPoint[]): Promise<TrainedModel> {
    const startTime = Date.now();
    this.originalData = timeSeries.map(point => point.value);
    
    this.fitted = [];
    this.residuals = [];

    for (let i = 0; i < this.originalData.length; i++) {
      if (i < this.seasonLength) {
        // For initial season, use naive forecast (previous value or mean)
        const prediction = i === 0 ? this.originalData[0] : this.originalData[i - 1];
        this.fitted.push(prediction);
      } else {
        // Use seasonal naive: same period from previous season
        const prediction = this.originalData[i - this.seasonLength];
        this.fitted.push(prediction);
      }
      this.residuals.push(this.originalData[i] - this.fitted[i]);
    }

    const validationMetrics = this.calculateMetrics(this.originalData, this.fitted);

    return {
      id: `seasonal_naive_${this.seasonLength}_${Date.now()}`,
      name: `Seasonal Naive (${this.seasonLength})`,
      type: 'SeasonalNaive' as any,
      params: { seasonLength: this.seasonLength } as any,
      coefficients: [this.seasonLength],
      residuals: this.residuals,
      fitted: this.fitted,
      aic: validationMetrics.aic,
      bic: validationMetrics.bic,
      logLikelihood: -validationMetrics.aic / 2,
      trainedAt: new Date(),
      trainingTime: Date.now() - startTime,
      convergenceStatus: 'converged',
      validationMetrics
    };
  }

  async forecast(horizon: number): Promise<ForecastResult> {
    const predictions: TimeSeriesDataPoint[] = [];
    const lastSeason = this.originalData.slice(-this.seasonLength);
    
    for (let i = 1; i <= horizon; i++) {
      const seasonIndex = (i - 1) % this.seasonLength;
      const prediction = lastSeason[seasonIndex];
      
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        timestamp: Date.now() + i * 24 * 60 * 60 * 1000,
        value: Math.max(0, prediction),
        label: `Forecast ${i}`
      });
    }

    const baseError = Math.sqrt(this.residuals.reduce((sum, r) => sum + r * r, 0) / this.residuals.length);
    const metrics = this.calculateMetrics(this.originalData, this.fitted);

    return {
      modelId: `seasonal_naive_${this.seasonLength}`,
      predictions,
      confidenceIntervals: {
        lower: predictions.map((_, i) => Math.max(0, predictions[i].value - 1.96 * baseError)),
        upper: predictions.map((_, i) => predictions[i].value + 1.96 * baseError)
      },
      forecastOrigin: new Date(),
      horizon,
      metrics
    };
  }
}

class LinearTrendModel extends BaselineModel {
  private slope: number = 0;
  private intercept: number = 0;

  async train(timeSeries: TimeSeriesDataPoint[]): Promise<TrainedModel> {
    const startTime = Date.now();
    this.originalData = timeSeries.map(point => point.value);
    const n = this.originalData.length;
    
    // Calculate linear trend using least squares
    const x = Array.from({length: n}, (_, i) => i);
    const y = this.originalData;
    
    const xMean = mean(x);
    const yMean = mean(y);
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += (x[i] - xMean) ** 2;
    }
    
    this.slope = denominator === 0 ? 0 : numerator / denominator;
    this.intercept = yMean - this.slope * xMean;
    
    // Calculate fitted values
    this.fitted = x.map(xi => this.intercept + this.slope * xi);
    this.residuals = y.map((yi, i) => yi - this.fitted[i]);

    const validationMetrics = this.calculateMetrics(this.originalData, this.fitted);

    return {
      id: `linear_trend_${Date.now()}`,
      name: 'Linear Trend',
      type: 'LinearTrend' as any,
      params: { slope: this.slope, intercept: this.intercept } as any,
      coefficients: [this.intercept, this.slope],
      residuals: this.residuals,
      fitted: this.fitted,
      aic: validationMetrics.aic,
      bic: validationMetrics.bic,
      logLikelihood: -validationMetrics.aic / 2,
      trainedAt: new Date(),
      trainingTime: Date.now() - startTime,
      convergenceStatus: 'converged',
      validationMetrics
    };
  }

  async forecast(horizon: number): Promise<ForecastResult> {
    const predictions: TimeSeriesDataPoint[] = [];
    const n = this.originalData.length;
    
    for (let i = 1; i <= horizon; i++) {
      const prediction = this.intercept + this.slope * (n + i - 1);
      
      predictions.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        timestamp: Date.now() + i * 24 * 60 * 60 * 1000,
        value: Math.max(0, prediction),
        label: `Forecast ${i}`
      });
    }

    const baseError = Math.sqrt(this.residuals.reduce((sum, r) => sum + r * r, 0) / this.residuals.length);
    const metrics = this.calculateMetrics(this.originalData, this.fitted);

    return {
      modelId: 'linear_trend',
      predictions,
      confidenceIntervals: {
        lower: predictions.map((_, i) => Math.max(0, predictions[i].value - 1.96 * baseError * Math.sqrt(1 + 1/this.originalData.length + (i + 1)**2 / this.originalData.length))),
        upper: predictions.map((_, i) => predictions[i].value + 1.96 * baseError * Math.sqrt(1 + 1/this.originalData.length + (i + 1)**2 / this.originalData.length))
      },
      forecastOrigin: new Date(),
      horizon,
      metrics
    };
  }
}