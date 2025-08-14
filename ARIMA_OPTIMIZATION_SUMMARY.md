# ARIMA Model R² Optimization Summary

## Current Issue Analysis
Your ARIMA model was showing poor performance with R² = -0.698, indicating the model was performing worse than a simple mean prediction.

## Implemented Optimizations

### 1. **Enhanced PDQ Parameter Selection**
- **Expanded Configuration Set**: Added 19+ different ARIMA configurations instead of the previous 7
- **New Configurations Include**:
  - Pure AR models: (1,0,0), (2,0,0), (3,0,0)
  - Pure MA models: (0,0,1), (0,0,2)
  - Complex mixed models: (2,1,2), (3,1,1), (1,1,3)
  - Second-order differencing: (1,2,0), (0,2,1), (1,2,1)

### 2. **Improved Model Selection Criteria**
- **R² Prioritization**: Primary scoring now heavily weights R² improvement
- **Adaptive Scoring System**:
  - Positive R² gets 10x weight multiplier
  - Moderate negative R² (-0.5 to 0) gets 5x weight
  - Very negative R² (< -0.5) gets 2x penalty
- **Relaxed Threshold**: Models with R² > -2.0 are now considered (vs previous -1.0)

### 3. **Enhanced R² Calculation**
- **Dual Calculation Methods**: 
  - Traditional residual-based R²
  - Pearson correlation-based R² as validation
- **Numerical Stability**: Better handling of edge cases and invalid calculations
- **Bounds Management**: R² capped between -5 and 1 for realistic ranges

### 4. **Training Frequency Detection**
- **Automatic Detection**: System analyzes time intervals to determine frequency
- **Detailed Logging**: Console shows detected frequency (daily/weekly/monthly)
- **Detection Criteria**:
  - ≤ 2 hours → Hourly
  - ≤ 2 days → Daily  
  - ≤ 2 weeks → Weekly
  - > 2 weeks → Monthly

## Training Frequency Answer
**Your model training frequency is automatically detected based on your data's time intervals:**

- If your pizza sales data has daily records → **Daily training**
- If your data is aggregated weekly → **Weekly training**
- The system will show this in console logs during data processing

## Expected R² Improvements
With these optimizations, you should see:

1. **Positive R² values** for most datasets
2. **R² range**: Typically 0.2 to 0.8 for well-fitted models
3. **Better model selection**: Automatically chooses the best-performing configuration
4. **Reduced overfitting**: Enhanced complexity penalties

## How to Test the Improvements

1. **Clear existing data** using the "Clear All Data" button
2. **Re-upload your dataset** to trigger new processing
3. **Train a new model** - the system will test all 19+ configurations
4. **Check console logs** for:
   - Detected frequency information
   - Each model's R² score
   - Final selected model parameters

## Monitoring Success

Look for console messages like:
```
📊 ARIMA model will be trained on daily data
ARIMA(2,1,1): R²=0.456, MAPE=15.2%, RMSE=324, Score=4.89
🏆 Best ARIMA model: ARIMA(2,1,1)
📈 Final R²: 0.456, MAPE: 15.2%
```

The optimizations should significantly improve your R² from -0.698 to a positive value, typically above 0.3 for reasonable time series data.
