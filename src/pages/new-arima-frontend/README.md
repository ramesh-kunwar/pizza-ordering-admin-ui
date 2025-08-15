# 🍕 New ARIMA Forecasting Dashboard

A modern, user-friendly frontend interface for pizza sales forecasting using ARIMA models.

## ✨ Features

### 📊 **Data Upload & Validation**
- Drag-and-drop CSV upload with validation
- Real-time file preview and column detection
- Smart column auto-selection for date and value fields
- File validation with helpful error messages and warnings

### ⚙️ **Configurable Training**
- Customizable train/test split ratios (10%, 20%, 30%)
- Flexible forecast horizons (7, 14, 30, 60 days)
- Automatic ARIMA parameter optimization
- Real-time training progress with loading indicators

### 📈 **Interactive Visualizations**
- **Recharts-powered charts** with smooth animations
- **Line and Area chart modes** for different viewing preferences
- **Toggle confidence intervals** and test data visibility
- **Responsive design** that works on all screen sizes
- **Custom tooltips** with formatted values

### 📋 **Comprehensive Data Tables**
- **Forecast results** with confidence intervals
- **Export to CSV** functionality
- **Summary statistics** (total, average, min, max forecasts)
- **Sortable columns** with pagination
- **Confidence range indicators** with color coding

### 🎯 **Performance Analysis**
- **Visual performance metrics** with progress bars
- **Overall model grading** (A, B, C, D) with explanations
- **Detailed error metrics** (MAPE, R², MAE, RMSE, MSE)
- **Model interpretation** with actionable insights
- **Stationarity test results** and model complexity analysis

### 🔧 **Advanced Features**
- **Backend health monitoring** with automatic retry
- **Session management** with unique IDs
- **Data download** capabilities (JSON/CSV)
- **Multi-step wizard** interface
- **Responsive mobile design**

## 🏗️ Architecture

### **Component Structure**
```
new-arima-frontend/
├── components/
│   ├── CSVUploader.tsx          # File upload and validation
│   ├── ForecastChart.tsx        # Interactive chart visualization
│   ├── ForecastTable.tsx        # Data table with export
│   └── PerformanceMetrics.tsx   # Model performance analysis
├── services/
│   └── arimaApi.ts              # API communication layer
├── types/
│   └── index.ts                 # TypeScript definitions
└── NewArimaForecastingDashboard.tsx  # Main dashboard component
```

### **Technology Stack**
- **React 18** with TypeScript
- **Ant Design** for UI components
- **Recharts** for data visualization
- **date-fns** for date formatting
- **Axios** for API communication

## 🚀 Quick Start

### **1. Navigate to the Dashboard**
- Go to `/new-arima-forecasting` in your admin dashboard
- The new menu item "🍕 New ARIMA Forecasting" will be visible

### **2. Check Backend Status**
- The dashboard automatically checks if the ARIMA backend is running
- Ensure the backend is available at `http://localhost:8080`

### **3. Upload Sales Data**
- Click or drag your CSV file to the upload area
- Ensure your CSV has:
  - A date column (e.g., "date", "order_date", "timestamp")
  - A numeric value column (e.g., "sales", "revenue", "quantity")
  - At least 50+ data points for better accuracy

### **4. Configure Settings**
- **Date Column**: Select the column containing dates
- **Value Column**: Select the column to forecast
- **Test Split**: Choose how much data to use for testing (recommended: 20%)
- **Forecast Horizon**: Select how many days to forecast (7 or 30 days)

### **5. View Results**
- **Performance Metrics**: Check model accuracy and reliability
- **Forecast Chart**: Interactive visualization with confidence intervals
- **Data Table**: Detailed forecast values with export options

## 📊 Understanding the Results

### **Performance Grades**
- **Grade A (Excellent)**: MAPE < 10%, R² > 0.7, Directional Accuracy > 60%
- **Grade B (Good)**: MAPE < 20%, R² > 0.5, Directional Accuracy > 50%
- **Grade C (Fair)**: MAPE < 30%, R² > 0.3, Directional Accuracy > 40%
- **Grade D (Poor)**: Model needs improvement

### **Key Metrics Interpretation**
- **MAPE (Mean Absolute Percentage Error)**: Lower is better (< 20% is good)
- **R² (Coefficient of Determination)**: Higher is better (> 0.5 is good)
- **Directional Accuracy**: Percentage of correct trend predictions (> 50% is good)

### **When to Trust the Forecast**
✅ **Use with confidence**: Grade A-B models with MAPE < 20%
⚠️ **Use with caution**: Grade C models with MAPE 20-30%
❌ **Don't rely on**: Grade D models or negative R²

## 🎨 UI/UX Features

### **Design Principles**
- **Consistent with Products page** styling and theme
- **Step-by-step wizard** for guided user experience
- **Progressive disclosure** - show complexity when needed
- **Responsive design** for all device sizes

### **Visual Indicators**
- 🟢 **Green**: Good performance, successful operations
- 🔵 **Blue**: Information, moderate performance
- 🟠 **Orange**: Warnings, fair performance
- 🔴 **Red**: Errors, poor performance

### **Interactive Elements**
- **Hover effects** on charts and tables
- **Tooltips** with detailed explanations
- **Loading states** with progress indicators
- **Error handling** with clear messaging

## 🔧 Configuration Options

### **File Upload Settings**
```typescript
// Supported file types
accept: '.csv'

// Maximum file size
maxSize: 100MB

// Minimum data requirements
minRows: 2 (header + 1 data row)
minColumns: 2 (date + value)
```

### **Training Parameters**
```typescript
// Test size options
testSize: 0.1 | 0.2 | 0.3  // 10%, 20%, 30%

// Forecast horizon options
forecastHorizon: 7 | 14 | 30 | 60  // days

// Auto-detected columns
dateColumns: /date|time|timestamp/i
valueColumns: /price|revenue|sales|quantity|amount|total|value/i
```

## 🚨 Troubleshooting

### **Common Issues**

**Backend Connection Error**
- Ensure ARIMA backend is running on `localhost:8080`
- Check network connectivity
- Verify backend health status indicator

**File Upload Failures**
- Check file format (must be .csv)
- Verify file size (< 100MB)
- Ensure proper column structure

**Poor Model Performance**
- Try different train/test split ratios
- Ensure sufficient data points (100+ recommended)
- Check data quality and consistency

**Missing Dependencies**
- All required packages are pre-installed
- No additional setup required

## 📝 API Integration

The frontend integrates with the existing ARIMA backend at `localhost:8080`:

### **Endpoints Used**
- `GET /` - Health check
- `POST /upload` - Upload CSV and train model
- `GET /forecast/{session_id}` - Get forecast results
- `GET /sessions` - List all sessions
- `GET /download/{session_id}` - Download results

### **Error Handling**
- Automatic retry on connection failures
- User-friendly error messages
- Graceful degradation when backend is offline

## 🎯 Future Enhancements

### **Planned Features**
- [ ] Multiple file format support (Excel, JSON)
- [ ] Batch processing for multiple datasets
- [ ] Custom model parameter tuning
- [ ] Email notifications for long-running forecasts
- [ ] Model comparison tools
- [ ] Historical forecast accuracy tracking

### **Performance Optimizations**
- [ ] Lazy loading for large datasets
- [ ] Chart virtualization for performance
- [ ] Background processing indicators
- [ ] Caching for frequent operations

## 📄 License

This component is part of the Pizza Ordering Microservice project and follows the same licensing terms.
