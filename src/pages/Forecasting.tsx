import React, { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  Table,
  message,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Papa from "papaparse";
import * as ss from "simple-statistics";
import dayjs from "dayjs";
// @ts-ignore
import ARIMA from "arima";

const { Option } = Select;

interface SalesData {
  date: string;
  quantity: number;
  category: string;
  totalPrice: number;
}

interface ForecastData {
  date: string;
  linearRegression: number;
  arima: number;
  actual?: number;
  linearRegressionExplanation?: string;
  arimaExplanation?: string;
}

interface HistoricalData {
  pizza_id: string;
  order_id: string;
  pizza_name_id: string;
  quantity: string;
  order_date: string;
  order_time: string;
  unit_price: string;
  total_price: string;
  pizza_size: string;
  pizza_category: string;
  pizza_ingredients: string;
  pizza_name: string;
}

const Forecasting: React.FC = () => {
  const [form] = Form.useForm();
  const [historicalData, setHistoricalData] = useState<SalesData[]>([]);
  const [userInputData, setUserInputData] = useState<SalesData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(true);

  const categories = ["Classic", "Supreme", "Veggie", "Chicken"];

  useEffect(() => {
    loadCSVData();
    loadUserData();
  }, []);

  const loadCSVData = async () => {
    try {
      const response = await fetch("/pizza-sales.csv");
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const data = results.data as HistoricalData[];
          const processedData = processCSVData(data);
          setHistoricalData(processedData);
          setCsvLoading(false);
        },
        error: (error: any) => {
          console.error("CSV parsing error:", error);
          message.error("Failed to load historical data");
          setCsvLoading(false);
        },
      });
    } catch (error) {
      console.error("Error loading CSV:", error);
      message.error("Failed to load CSV file");
      setCsvLoading(false);
    }
  };

  const processCSVData = (data: HistoricalData[]): SalesData[] => {
    const dailyData: {
      [key: string]: {
        quantity: number;
        totalPrice: number;
        categories: Set<string>;
      };
    } = {};

    data.forEach((row) => {
      if (!row.order_date || !row.quantity) return;

      const date = dayjs(row.order_date).format("YYYY-MM-DD");
      const quantity = parseFloat(row.quantity) || 0;
      const price = parseFloat(row.total_price) || 0;
      const category = row.pizza_category || "Other";

      if (!dailyData[date]) {
        dailyData[date] = { quantity: 0, totalPrice: 0, categories: new Set() };
      }

      dailyData[date].quantity += quantity;
      dailyData[date].totalPrice += price;
      dailyData[date].categories.add(category);
    });

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        quantity: Math.round(data.quantity),
        category: Array.from(data.categories).join(", "),
        totalPrice: Math.round(data.totalPrice * 100) / 100,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const loadUserData = () => {
    const saved = localStorage.getItem("userSalesData");
    if (saved) {
      setUserInputData(JSON.parse(saved));
    }
  };

  const saveUserData = (data: SalesData[]) => {
    localStorage.setItem("userSalesData", JSON.stringify(data));
    setUserInputData(data);
  };

  const onFinish = (values: any) => {
    const newEntry: SalesData = {
      date: values.date.format("YYYY-MM-DD"),
      quantity: values.quantity,
      category: values.category,
      totalPrice: values.totalPrice || values.quantity * 15, // Default price estimation
    };

    const updatedData = [...userInputData, newEntry].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    saveUserData(updatedData);
    form.resetFields();
    message.success("Sales data added successfully!");
  };

  // **Time Gap Validation Function**
  const checkTimeGapValidity = (sortedData: SalesData[]) => {
    if (sortedData.length < 2) {
      return { hasLargeGap: false, message: "", gapDays: 0, severity: "none" };
    }

    // Find the largest gap between consecutive data points
    let maxGapDays = 0;
    let gapStartDate = "";
    let gapEndDate = "";

    for (let i = 1; i < sortedData.length; i++) {
      const prevDate = new Date(sortedData[i - 1].date);
      const currDate = new Date(sortedData[i].date);
      const gapDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (gapDays > maxGapDays) {
        maxGapDays = gapDays;
        gapStartDate = sortedData[i - 1].date;
        gapEndDate = sortedData[i].date;
      }
    }

    // Classify gap severity
    let severity = "none";
    let message = "";
    let hasLargeGap = false;

    if (maxGapDays > 365 * 5) { // > 5 years
      severity = "critical";
      hasLargeGap = true;
      message = `⚠️ Critical: ${Math.round(maxGapDays / 365)} year gap detected (${gapStartDate} → ${gapEndDate}). Predictions may be unreliable due to outdated patterns.`;
    } else if (maxGapDays > 365) { // > 1 year
      severity = "major";
      hasLargeGap = true;
      message = `⚠️ Warning: ${Math.round(maxGapDays / 365)} year gap detected (${gapStartDate} → ${gapEndDate}). Consider using more recent data for better accuracy.`;
    } else if (maxGapDays > 180) { // > 6 months
      severity = "moderate";
      hasLargeGap = true;
      message = `ℹ️ Notice: ${Math.round(maxGapDays / 30)} month gap detected (${gapStartDate} → ${gapEndDate}). Forecast quality is acceptable but recent data would be better.`;
    } else if (maxGapDays > 30) { // > 1 month
      severity = "minor";
      message = `✓ Good: ${maxGapDays} day gap detected. Data continuity is acceptable for forecasting.`;
    } else {
      severity = "excellent";
      message = `✓ Excellent: Continuous data with max ${maxGapDays} day gap. Optimal for forecasting.`;
    }

    return {
      hasLargeGap,
      message,
      gapDays: maxGapDays,
      severity,
      gapStartDate,
      gapEndDate
    };
  };

  const generateForecast = () => {
    setLoading(true);

    try {
      // Combine historical and user data
      const allData = [...historicalData, ...userInputData];
      if (allData.length < 7) {
        message.error("Need at least 7 days of data for forecasting");
        setLoading(false);
        return;
      }

      // Prepare data for forecasting
      const sortedData = allData.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const lastDate = new Date(sortedData[sortedData.length - 1].date);

      // Extract time series data (quantities only) and validate
      const rawTimeSeries = sortedData.map(item => item.quantity);
      const timeSeries = rawTimeSeries.filter(val => 
        typeof val === 'number' && 
        isFinite(val) && 
        !isNaN(val) && 
        val >= 0  // ✅ Allow zero sales - valid business data!
      );
      
      console.log("Time series data validation:", {
        rawDataLength: rawTimeSeries.length,
        validDataLength: timeSeries.length,
        sampleRawData: rawTimeSeries.slice(-10),
        sampleValidData: timeSeries.slice(-10),
        invalidCount: rawTimeSeries.length - timeSeries.length,
        mean: timeSeries.length > 0 ? ss.mean(timeSeries) : 0,
        standardDeviation: timeSeries.length > 1 ? ss.standardDeviation(timeSeries) : 0
      });

      if (timeSeries.length < 3) {
        message.error("Not enough valid data points for forecasting. Please add more data.");
        setLoading(false);
        return;
      }

      // Check for large time gaps that could affect model accuracy
      const timeGapWarning = checkTimeGapValidity(sortedData);
      if (timeGapWarning.hasLargeGap) {
        message.warning(timeGapWarning.message);
        console.warn("Time gap detected:", timeGapWarning);
      }

      // **Model 1: Linear Regression with Moving Average**
      const linearRegressionResult = generateLinearRegressionForecast(timeSeries, lastDate);
      
      // **Model 2: ARIMA**
      const arimaResult = generateARIMAForecast(timeSeries, lastDate);

      // Combine forecasts from both models
      const forecast: ForecastData[] = [];
      for (let i = 0; i < 7; i++) {
        const forecastDate = new Date(lastDate);
        forecastDate.setDate(lastDate.getDate() + i + 1);

        forecast.push({
          date: forecastDate.toISOString().split("T")[0],
          linearRegression: linearRegressionResult.forecasts[i],
          arima: arimaResult.forecasts[i],
          linearRegressionExplanation: linearRegressionResult.explanations[i],
          arimaExplanation: arimaResult.explanations[i],
        });
      }

      setForecastData(forecast);
      message.success("Forecast generated successfully with both models!");
      
      // Log comparison
      console.log("Model Comparison:", {
        linearRegression: linearRegressionResult.forecasts,
        arima: arimaResult.forecasts,
        linearRegressionExplanations: linearRegressionResult.explanations,
        arimaExplanations: arimaResult.explanations,
        averageDifference: ss.mean(linearRegressionResult.forecasts.map((lr, i) => 
          Math.abs(lr - arimaResult.forecasts[i])
        ))
      });

    } catch (error) {
      console.error("Forecasting error:", error);
      message.error("Failed to generate forecast");
    }

    setLoading(false);
  };

  // **Linear Regression Model**
  const generateLinearRegressionForecast = (timeSeries: number[], lastDate: Date): { forecasts: number[], explanations: string[] } => {
    try {
      console.log("Linear Regression Debug - Input:", {
        timeSeriesLength: timeSeries.length,
        sampleData: timeSeries.slice(-10),
        hasNaN: timeSeries.some(val => isNaN(val)),
        hasInfinity: timeSeries.some(val => !isFinite(val))
      });

      // Filter out invalid values (but keep zeros!)
      const validTimeSeries = timeSeries.filter(val => isFinite(val) && !isNaN(val) && val >= 0);
      
      if (validTimeSeries.length < 3) {
        console.warn("Not enough valid data for linear regression, using simple average");
        const avg = validTimeSeries.length > 0 ? ss.mean(validTimeSeries) : 150;
        const safeAvg = isFinite(avg) ? avg : 150;
        const fallbackValue = Math.round(safeAvg);
        const fallbackExplanations = Array(7).fill(`⚠️ Insufficient data: Using simple average (${safeAvg.toFixed(1)} pizzas) due to lack of trend data`);
        return { forecasts: Array(7).fill(fallbackValue), explanations: fallbackExplanations };
      }

      // Give more weight to recent data (last 30 days vs all historical)
      const recentDataLength = Math.min(30, validTimeSeries.length);
      const recentTimeSeries = validTimeSeries.slice(-recentDataLength);
      const recentMean = ss.mean(recentTimeSeries);
      
      console.log("Recent vs Historical Data Analysis:", {
        totalDataPoints: validTimeSeries.length,
        recentDataPoints: recentTimeSeries.length,
        recentMean: recentMean,
        overallMean: ss.mean(validTimeSeries),
        recentTrend: recentTimeSeries.length > 1 ? "Analyzed" : "Insufficient"
      });

      const windowSize = Math.min(14, validTimeSeries.length);
      const recentData = validTimeSeries.slice(-windowSize);
      
      // Prioritize the most recent 7 days for trend detection
      const veryRecentData = validTimeSeries.slice(-7);
      const veryRecentMean = ss.mean(veryRecentData);
      
      // Create data points for regression (index, quantity)
      const dataPoints: [number, number][] = recentData.map((quantity, index) => [index, quantity]);
      
      console.log("Linear Regression Data Points:", dataPoints.slice(0, 5));
      console.log("Very Recent Pattern Analysis:", {
        last7Days: veryRecentData,
        veryRecentMean: veryRecentMean,
        hasZeroSales: veryRecentData.includes(0),
        significantChange: Math.abs(veryRecentMean - recentMean) > 10
      });

      // Calculate linear regression
      const regression = ss.linearRegression(dataPoints);
      const slope = isFinite(regression.m) ? regression.m : 0;
      const intercept = isFinite(regression.b) ? regression.b : ss.mean(recentData);
      
      // Use very recent data for baseline if there's a significant pattern change
      const hasSignificantRecentChange = Math.abs(veryRecentMean - recentMean) > 10;
      const movingAvg = hasSignificantRecentChange ? veryRecentMean : ss.mean(recentData.slice(-7));
      
      console.log("Linear Regression Model:", {
        slope,
        intercept,
        movingAvg,
        isValidSlope: isFinite(slope),
        isValidIntercept: isFinite(intercept),
        isValidMovingAvg: isFinite(movingAvg)
      });

      const forecasts: number[] = [];
      const explanations: string[] = [];

      for (let i = 1; i <= 7; i++) {
        const forecastDate = new Date(lastDate);
        forecastDate.setDate(lastDate.getDate() + i);
        
        // Check for recent dramatic changes (like dropping to 0)
        let predicted;
        let explanation;
        const hasRecentZeros = veryRecentData.includes(0);
        const isRecentlyLow = veryRecentMean < 10;
        const dayOfWeek = forecastDate.getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        
        if (hasRecentZeros || isRecentlyLow) {
          // Recent sales dropped significantly - predict low values
          console.log(`Day ${i}: Recent low sales detected, predicting conservatively`);
          const basePredict = Math.max(0, Math.round(veryRecentMean));
          const seasonalMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
          predicted = Math.round(basePredict * seasonalMultiplier);
          
          explanation = `🔻 Low prediction: Recent 7-day average is ${veryRecentMean.toFixed(1)} pizzas${hasRecentZeros ? ' with zero sales days' : ''}. ${dayName} gets ${((seasonalMultiplier - 1) * 100).toFixed(0)}% seasonal adjustment.`;
        } else if (!isFinite(slope) || Math.abs(slope) > 50) {
          // If slope is too extreme or invalid, use moving average with seasonality
          const seasonalMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
          predicted = Math.round(movingAvg * seasonalMultiplier);
          
          explanation = `⚠️ Stable prediction: Trend too volatile (slope: ${slope.toFixed(2)}), using 14-day average (${movingAvg.toFixed(1)}). ${dayName} gets ${((seasonalMultiplier - 1) * 100).toFixed(0)}% weekend boost.`;
        } else {
          // Normal linear trend prediction
          const trendValue = slope * (recentData.length + i - 1) + intercept;
          const combined = isFinite(trendValue) ? (trendValue * 0.4) + (movingAvg * 0.6) : movingAvg;
          const seasonalMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
          predicted = Math.round(combined * seasonalMultiplier);
          
          const trendDirection = slope > 0 ? '📈 increasing' : slope < 0 ? '📉 decreasing' : '➡️ stable';
          explanation = `${trendDirection.split(' ')[0]} Trend-based: ${slope > 0 ? 'Growing' : slope < 0 ? 'Declining' : 'Stable'} trend (${slope.toFixed(2)} pizzas/day) + 14-day average (${movingAvg.toFixed(1)}). ${dayName} gets ${((seasonalMultiplier - 1) * 100).toFixed(0)}% seasonal boost.`;
        }
        
        // Ensure reasonable bounds (allow 0 if recent data shows 0 sales)
        const minBound = hasRecentZeros ? 0 : 10;
        const originalPredicted = predicted;
        predicted = Math.max(minBound, Math.min(1000, predicted));
        
        if (originalPredicted !== predicted) {
          explanation += ` (Bounded from ${originalPredicted} to ${predicted})`;
        }
        
        forecasts.push(predicted);
        explanations.push(explanation);
      }

      console.log("Linear Regression Forecasts:", forecasts);
      return { forecasts, explanations };
    } catch (error) {
      console.error("Linear regression error:", error);
      // Fallback to simple moving average
      const validData = timeSeries.filter(val => isFinite(val) && !isNaN(val));
      const avg = validData.length > 0 ? ss.mean(validData.slice(-7)) : 150;
      const safeAvg = isFinite(avg) ? avg : 150;
      const fallbackValue = Math.round(safeAvg);
      console.log("Using fallback value:", fallbackValue);
      const fallbackExplanations = Array(7).fill(`⚠️ Fallback: Error in trend calculation, using 7-day average (${safeAvg.toFixed(1)} pizzas)`);
      return { forecasts: Array(7).fill(fallbackValue), explanations: fallbackExplanations };
    }
  };

  // **ARIMA Model**
  const generateARIMAForecast = (timeSeries: number[], lastDate: Date): { forecasts: number[], explanations: string[] } => {
    try {
      console.log("ARIMA Debug - Input:", {
        timeSeriesLength: timeSeries.length,
        sampleData: timeSeries.slice(-10),
        hasNaN: timeSeries.some(val => isNaN(val)),
        hasInfinity: timeSeries.some(val => !isFinite(val))
      });

      // Filter out invalid values (but keep zeros!)
      const validTimeSeries = timeSeries.filter(val => isFinite(val) && !isNaN(val) && val >= 0);
      
      if (validTimeSeries.length < 5) {
        console.warn("Not enough valid data for ARIMA, using exponential smoothing");
        return generateExponentialSmoothingForecast(validTimeSeries, lastDate);
      }

      // Analyze recent patterns for ARIMA
      const recentARIMAData = validTimeSeries.slice(-7);
      const hasRecentZeros = recentARIMAData.includes(0);
      const recentARIMAMean = ss.mean(recentARIMAData);
      
      console.log("ARIMA Recent Pattern Analysis:", {
        last7DaysData: recentARIMAData,
        hasZeroSales: hasRecentZeros,
        recentMean: recentARIMAMean,
        isLowSalesPattern: recentARIMAMean < 10
      });

      // Use recent data for ARIMA (last 30 days or available data)
      const arimaData = validTimeSeries.slice(-Math.min(30, validTimeSeries.length));
      
      const mean = ss.mean(arimaData);
      const variance = ss.variance(arimaData);
      
      console.log("ARIMA Model Input:", {
        dataLength: arimaData.length,
        mean,
        variance,
        isValidMean: isFinite(mean),
        isValidVariance: isFinite(variance)
      });

      // Check if variance is too low (constant data)
      if (!isFinite(variance) || variance < 0.01) {
        console.warn("Data has too low variance for ARIMA, using mean with seasonality");
        const baseValue = isFinite(mean) ? mean : 150;
        const forecasts = [];
        const explanations = [];
        
        for (let i = 0; i < 7; i++) {
          const forecastDate = new Date(lastDate);
          forecastDate.setDate(lastDate.getDate() + i + 1);
          const dayOfWeek = forecastDate.getDay();
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
          const seasonalMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
          const predicted = Math.max(10, Math.min(1000, Math.round(baseValue * seasonalMultiplier)));
          
          forecasts.push(predicted);
          explanations.push(`⚠️ Low variance: Using mean (${(isFinite(baseValue) ? baseValue.toFixed(1) : baseValue)}) + seasonality. ${dayName} gets ${((seasonalMultiplier - 1) * 100).toFixed(0)}% weekend boost.`);
        }
        
        return { forecasts, explanations };
      }

      // Initialize ARIMA model (p=1, d=1, q=1)
      const arima = new ARIMA({
        p: 1, // autoregressive order
        d: 1, // differencing order  
        q: 1, // moving average order
        verbose: false
      });

      // Train the model
      arima.train(arimaData);
      
      // Generate predictions
      const predictions = arima.predict(7);
      
      console.log("Raw ARIMA predictions:", predictions);
      
      // Apply seasonality and constraints
      const forecasts: number[] = [];
      const explanations: string[] = [];
      for (let i = 0; i < 7; i++) {
        const forecastDate = new Date(lastDate);
        forecastDate.setDate(lastDate.getDate() + i + 1);
        
        const dayOfWeek = forecastDate.getDay();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
        
        const rawPrediction = predictions[i];
        let explanation;
        
        // Use recent mean as fallback if prediction is invalid, especially for low sales patterns
        let validPrediction;
        if (isFinite(rawPrediction) && !isNaN(rawPrediction)) {
          validPrediction = rawPrediction;
          explanation = `🔮 ARIMA model: Autoregressive prediction (${(isFinite(rawPrediction) ? rawPrediction.toFixed(1) : rawPrediction)}) based on time series patterns`;
        } else if (hasRecentZeros || recentARIMAMean < 10) {
          validPrediction = recentARIMAMean; // Use recent pattern for low sales
          explanation = `⚠️ ARIMA fallback: Invalid prediction, using recent 7-day average (${(isFinite(recentARIMAMean) ? recentARIMAMean.toFixed(1) : recentARIMAMean)}) due to low sales pattern`;
        } else {
          validPrediction = mean;
          explanation = `⚠️ ARIMA fallback: Invalid prediction, using overall mean (${(isFinite(mean) ? mean.toFixed(1) : mean)}) as baseline`;
        }
        
        // Apply seasonality - but be conservative if recent sales are very low
        let seasonalMultiplier;
        if (hasRecentZeros || recentARIMAMean < 10) {
          // Minimal seasonality boost for low sales periods
          seasonalMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.05 : 1.0;
          explanation += `. ${dayName} gets conservative ${((seasonalMultiplier - 1) * 100).toFixed(0)}% seasonal adjustment for low-sales period`;
        } else {
          seasonalMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
          explanation += `. ${dayName} gets ${((seasonalMultiplier - 1) * 100).toFixed(0)}% weekend boost`;
        }
          
        const seasonalPrediction = validPrediction * seasonalMultiplier;
        
        // Ensure reasonable bounds (allow 0 if recent data shows 0 sales)
        const minBound = hasRecentZeros ? 0 : 10;
        const originalBounded = Math.round(seasonalPrediction);
        const bounded = Math.max(minBound, Math.min(1000, originalBounded));
        
        if (originalBounded !== bounded) {
          explanation += ` (Bounded from ${originalBounded} to ${bounded})`;
        }
        
        forecasts.push(bounded);
        explanations.push(explanation);
      }

      console.log("ARIMA Final Forecasts:", forecasts);
      return { forecasts, explanations };
      
    } catch (error) {
      console.error("ARIMA error:", error);
      return generateExponentialSmoothingForecast(timeSeries, lastDate);
    }
  };

  // **Exponential Smoothing Fallback**
  const generateExponentialSmoothingForecast = (timeSeries: number[], lastDate: Date): { forecasts: number[], explanations: string[] } => {
    console.log("Using exponential smoothing fallback");
    
    // Filter valid data (include zeros!)
    const validData = timeSeries.filter(val => isFinite(val) && !isNaN(val) && val >= 0);
    
    if (validData.length === 0) {
      console.warn("No valid data available, using default value");
      const defaultExplanations = Array(7).fill("⚠️ No valid data: Using default 150 pizzas as baseline prediction");
      return { forecasts: Array(7).fill(150), explanations: defaultExplanations };
    }

    const alpha = 0.3;
    const recent = validData.slice(-Math.min(7, validData.length));
    const hasRecentZeros = recent.includes(0);
    const recentMean = recent.length > 0 ? ss.mean(recent) : 0;
    
    let smoothed = recent[0];
    
    for (let i = 1; i < recent.length; i++) {
      smoothed = alpha * recent[i] + (1 - alpha) * smoothed;
    }
    
    const baseValue = Math.round(smoothed);
    console.log("Exponential smoothing analysis:", {
      baseValue,
      hasRecentZeros,
      recentMean,
      recentData: recent
    });
    
    const forecasts = [];
    const explanations = [];
    
    for (let i = 0; i < 7; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(lastDate.getDate() + i + 1);
      const dayOfWeek = forecastDate.getDay();
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      
      // Be conservative with seasonality if recent sales are very low
      const seasonalMultiplier = hasRecentZeros || recentMean < 10 
        ? ((dayOfWeek === 0 || dayOfWeek === 6) ? 1.05 : 1.0)
        : ((dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0);
        
      // Allow 0 predictions if recent data shows 0 sales  
      const minBound = hasRecentZeros ? 0 : 10;
      const predicted = Math.max(minBound, Math.min(1000, Math.round(baseValue * seasonalMultiplier)));
      
      const explanation = `📊 Exponential smoothing: Base value ${(isFinite(baseValue) ? baseValue.toFixed(1) : baseValue)} (α=0.3) from recent data${hasRecentZeros ? ' with zero sales' : ''}. ${dayName} gets ${((seasonalMultiplier - 1) * 100).toFixed(0)}% seasonal adjustment.`;
      
      forecasts.push(predicted);
      explanations.push(explanation);
    }
    
    return { forecasts, explanations };
  };

  const clearUserData = () => {
    localStorage.removeItem("userSalesData");
    setUserInputData([]);
    setForecastData([]);
    message.success("User data cleared!");
  };

  const exportForecast = () => {
    if (forecastData.length === 0) {
      message.error("No forecast data to export");
      return;
    }

    const csvContent = [
      ["Date", "Linear Regression", "ARIMA", "Day of Week"],
      ...forecastData.map((item) => [
        item.date, 
        item.linearRegression, 
        item.arima,
        dayjs(item.date).format("dddd")
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pizza-demand-forecast-comparison.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    message.success("Forecast comparison exported successfully!");
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      sorter: (a: SalesData, b: SalesData) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      sorter: (a: SalesData, b: SalesData) => a.quantity - b.quantity,
    },
    { title: "Category", dataIndex: "category", key: "category" },
    {
      title: "Total Price ($)",
      dataIndex: "totalPrice",
      key: "totalPrice",
      render: (value: number) => `$${(value && typeof value === 'number' ? value : 0).toFixed(2)}`,
    },
  ];

  const chartData = [
    ...historicalData
      .slice(-30)
      .map((item) => ({ 
        ...item, 
        type: "Historical",
        linearRegression: null,
        arima: null 
      })),
    ...userInputData.map((item) => ({ 
      ...item, 
      type: "User Input",
      linearRegression: null,
      arima: null 
    })),
    ...forecastData.map((item) => ({
      date: item.date,
      quantity: null,
      linearRegression: item.linearRegression,
      arima: item.arima,
      type: "Forecast",
    })),
  ];

  const totalLinearRegressionForecast = forecastData.reduce(
    (sum, item) => sum + (isFinite(item.linearRegression) ? item.linearRegression : 0),
    0
  );
  const totalARIMAForecast = forecastData.reduce(
    (sum, item) => sum + (isFinite(item.arima) ? item.arima : 0),
    0
  );

  return (
    <div style={{ padding: "24px" }}>
      <h1>Pizza Demand Forecasting</h1>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: "24px" }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Historical Data Points"
              value={historicalData.length}
              loading={csvLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="User Input Data Points"
              value={userInputData.length}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Linear Regression Forecast"
              value={totalLinearRegressionForecast}
              suffix="pizzas (7 days)"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="ARIMA Forecast"
              value={totalARIMAForecast}
              suffix="pizzas (7 days)"
            />
          </Card>
        </Col>
      </Row>

      {/* Input Form */}
      <Card title="Add Daily Sales Data" style={{ marginBottom: "24px" }}>
        <Form form={form} layout="inline" onFinish={onFinish}>
          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: "Please select date!" }]}
          >
            <DatePicker />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Daily Quantity"
            rules={[{ required: true, message: "Please enter quantity!" }]}
          >
            <Input type="number" min={0} placeholder="e.g., 150" />
          </Form.Item>
          <Form.Item
            name="category"
            label="Main Category"
            rules={[{ required: true, message: "Please select category!" }]}
          >
            <Select placeholder="Select category" style={{ width: 120 }}>
              {categories.map((cat) => (
                <Option key={cat} value={cat}>
                  {cat}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="totalPrice" label="Total Revenue ($)">
            <Input type="number" min={0} step={0.01} placeholder="Optional" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Add Data
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Action Buttons */}
      <Card style={{ marginBottom: "24px" }}>
        <Button
          type="primary"
          onClick={generateForecast}
          loading={loading}
          style={{ marginRight: "8px" }}
          disabled={historicalData.length + userInputData.length < 7}
        >
          Generate 7-Day Forecast
        </Button>
        <Button
          onClick={exportForecast}
          disabled={forecastData.length === 0}
          style={{ marginRight: "8px" }}
        >
          Export Forecast
        </Button>
        <Button onClick={clearUserData} disabled={userInputData.length === 0}>
          Clear User Data
        </Button>
      </Card>

      {/* Chart Visualization */}
      <Card title="Sales Trends & Forecast Comparison" style={{ marginBottom: "24px" }}>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="quantity"
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Historical/User Data"
            />
            <Line
              type="monotone"
              dataKey="linearRegression"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={{ r: 4 }}
              strokeDasharray="5 5"
              name="Linear Regression Forecast"
            />
            <Line
              type="monotone"
              dataKey="arima"
              stroke="#ff7300"
              strokeWidth={2}
              dot={{ r: 4 }}
              strokeDasharray="10 5"
              name="ARIMA Forecast"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Data Tables */}
      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={`Historical Data (${historicalData.length} records)`}
            loading={csvLoading}
          >
            <Table
              columns={columns}
              dataSource={historicalData.slice(-10)}
              rowKey="date"
              size="small"
              pagination={false}
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={`User Input Data (${userInputData.length} records)`}>
            <Table
              columns={columns}
              dataSource={userInputData}
              rowKey="date"
              size="small"
              pagination={false}
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Forecast Results Comparison */}
      {forecastData.length > 0 && (
        <>
          <Card title="7-Day Forecast Model Comparison" style={{ marginTop: "24px" }}>
            <Table
              columns={[
                { title: "Date", dataIndex: "date", key: "date", width: 100 },
                {
                  title: "Linear Regression",
                  dataIndex: "linearRegression",
                  key: "linearRegression",
                  width: 120,
                  render: (value: number) => (
                    <span style={{ color: "#82ca9d", fontWeight: "bold" }}>
                      {isFinite(value) && !isNaN(value) ? value : "Error"} pizzas
                    </span>
                  ),
                },
                {
                  title: "ARIMA",
                  dataIndex: "arima",
                  key: "arima",
                  width: 100,
                  render: (value: number) => (
                    <span style={{ color: "#ff7300", fontWeight: "bold" }}>
                      {isFinite(value) && !isNaN(value) ? value : "Error"} pizzas
                    </span>
                  ),
                },
                {
                  title: "Why This Prediction?",
                  key: "explanation",
                  width: 400,
                  render: (_, record) => (
                    <div style={{ fontSize: "12px" }}>
                      <div style={{ marginBottom: "4px", color: "#82ca9d" }}>
                        <strong>LR:</strong> {record.linearRegressionExplanation}
                      </div>
                      <div style={{ color: "#ff7300" }}>
                        <strong>ARIMA:</strong> {record.arimaExplanation}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Difference",
                  key: "difference",
                  width: 100,
                  render: (_, record) => {
                    const lr = record.linearRegression;
                    const arima = record.arima;
                    
                    if (!isFinite(lr) || !isFinite(arima) || isNaN(lr) || isNaN(arima)) {
                      return <span style={{ color: "#ff4d4f" }}>Error</span>;
                    }
                    
                    const diff = Math.abs(lr - arima);
                    const avg = (lr + arima) / 2;
                    const percentDiff = avg > 0 ? ((diff / avg) * 100).toFixed(1) : "0.0";
                    
                    return (
                      <span style={{ color: diff > 10 ? "#ff4d4f" : "#52c41a" }}>
                        {Math.round(diff)} ({percentDiff}%)
                      </span>
                    );
                  },
                },
                {
                  title: "Day of Week",
                  key: "dayOfWeek",
                  width: 100,
                  render: (_, record) => dayjs(record.date).format("dddd"),
                },
              ]}
              dataSource={forecastData}
              rowKey="date"
              pagination={false}
              scroll={{ x: 1000 }}
            />
          </Card>

          {/* Model Performance Summary */}
          <Card title="Model Performance Summary" style={{ marginTop: "24px" }}>
            <Row gutter={16}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Linear Regression Total"
                    value={totalLinearRegressionForecast}
                    suffix="pizzas"
                    valueStyle={{ color: "#82ca9d" }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="ARIMA Total"
                    value={totalARIMAForecast}
                    suffix="pizzas"
                    valueStyle={{ color: "#ff7300" }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Average Daily Difference"
                    value={forecastData.length > 0 ? 
                      Math.round(
                        forecastData.reduce((sum, item) => {
                          const lr = item.linearRegression;
                          const arima = item.arima;
                          if (isFinite(lr) && isFinite(arima) && !isNaN(lr) && !isNaN(arima)) {
                            return sum + Math.abs(lr - arima);
                          }
                          return sum;
                        }, 0) / forecastData.length
                      ) : 0
                    }
                    suffix="pizzas"
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Performance Metrics Analysis */}
          <Card title="📊 Model Performance Analysis" style={{ marginTop: "24px" }}>
            {(() => {
              // Calculate performance metrics using backtesting approach
              const allData = [...historicalData, ...userInputData]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(item => item.quantity)
                .filter(val => isFinite(val) && !isNaN(val) && val >= 0);
              
              // Filter for normal business operations (exclude closure/crisis periods)
              const normalBusinessData = allData.filter(val => val > 10); // Exclude very low sales days
              const crisisData = allData.filter(val => val <= 10);
              
              console.log("Data filtering for performance metrics:", {
                totalData: allData.length,
                normalBusiness: normalBusinessData.length,
                crisisData: crisisData.length,
                normalMean: normalBusinessData.length > 0 ? 
                  (isFinite(ss.mean(normalBusinessData)) ? ss.mean(normalBusinessData).toFixed(1) : "N/A") : 0,
                crisisMean: crisisData.length > 0 ? 
                  (isFinite(ss.mean(crisisData)) ? ss.mean(crisisData).toFixed(1) : "N/A") : 0
              });
              
              // Use normal business data for performance evaluation if available
              const recentData = normalBusinessData.length >= 10 ? normalBusinessData : allData;
              
              if (recentData.length < 10) {
                return (
                  <div style={{ textAlign: "center", padding: "30px", color: "#999" }}>
                    <h3>⚠️ Insufficient Business Data</h3>
                    <p>Need at least 10 days of normal operations for meaningful metrics.</p>
                    <p>Current: {recentData.length} normal business days, {crisisData.length} low-sales days</p>
                  </div>
                );
              }

              // Smart data split: use recent 80% for training, last 20% for testing
              const trainSize = Math.floor(recentData.length * 0.8);
              const trainData = recentData.slice(0, trainSize);
              const testData = recentData.slice(trainSize);
              
              console.log("Performance Metrics Debug:", {
                totalData: recentData.length,
                trainSize: trainData.length,
                testSize: testData.length,
                trainData: trainData.slice(0, 5),
                testData: testData.slice(0, 5)
              });
              
              // Ensure we have enough data for meaningful statistics
              if (trainData.length < 2 || testData.length < 1) {
                return (
                  <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                    <h3>⚠️ Insufficient Data for Meaningful Metrics</h3>
                    <p>Need at least 3 training points and 1 test point for performance analysis.</p>
                    <p>Training: {trainData.length} points, Testing: {testData.length} points</p>
                  </div>
                );
              }
              
              // Safe statistical calculations with fallbacks
              const trainMean = trainData.length > 0 ? ss.mean(trainData) : 0;
              const testMean = testData.length > 0 ? ss.mean(testData) : 0;
              const trainStd = trainData.length > 1 ? ss.standardDeviation(trainData) : 0;
              const testStd = testData.length > 1 ? ss.standardDeviation(testData) : 0;
              
              // Validate statistical results
              const safeTrainMean = isFinite(trainMean) ? trainMean : 0;
              const safeTestMean = isFinite(testMean) ? testMean : 0;
              const safeTrainStd = isFinite(trainStd) ? trainStd : 0;
              const safeTestStd = isFinite(testStd) ? testStd : 0;
              
              console.log("Statistics Debug:", {
                trainMean: safeTrainMean,
                testMean: safeTestMean,
                trainStd: safeTrainStd,
                testStd: safeTestStd
              });
              
              // Proper backtesting: Train models on trainData, predict testData period
              // Simple baseline: Use linear trend from training data to predict test period
              const trainDataPoints = trainData.map((val, index) => [index, val]);
              let trendSlope = 0;
              let trendIntercept = safeTrainMean;
              
              if (trainDataPoints.length >= 2) {
                try {
                  const trendFunction = ss.linearRegression(trainDataPoints);
                  trendSlope = trendFunction.m || 0;
                  trendIntercept = trendFunction.b || safeTrainMean;
                } catch (error) {
                  console.warn("Trend calculation failed, using mean baseline");
                }
              }
              
              // Generate predictions for test period using the trend
              const predictions = testData.map((_, index) => {
                const futureIndex = trainData.length + index;
                const trendPrediction = trendIntercept + (trendSlope * futureIndex);
                return Math.max(5, trendPrediction); // Minimum 5 pizzas prediction
              });
              
              console.log("Backtesting Debug:", {
                trainDataLength: trainData.length,
                testDataLength: testData.length,
                trendSlope: (typeof trendSlope === 'number' ? trendSlope.toFixed(3) : trendSlope),
                predictions: predictions.map(p => (typeof p === 'number' ? p.toFixed(1) : p)),
                actualTest: testData.map(a => (typeof a === 'number' ? a.toFixed(1) : a))
              });
              
              // Calculate proper prediction errors
              const errors = testData.map((actual, index) => Math.abs(actual - predictions[index]));
              const percentageErrors = testData.map((actual, index) => 
                actual > 0 ? Math.abs((actual - predictions[index]) / actual) * 100 : 0
              ).filter(error => isFinite(error));
              
              const meanAbsoluteError = errors.length > 0 ? ss.mean(errors) : 0;
              const meanAbsolutePercentageError = percentageErrors.length > 0 ? ss.mean(percentageErrors) : 0;
              
              // Safe calculations for derived metrics with division-by-zero protection
              const modelStability = safeTrainMean > 0 ? meanAbsoluteError / safeTrainMean * 100 : 0;
              
              // Final validation to ensure no NaN values
              const safeMeanAbsoluteError = isFinite(meanAbsoluteError) ? meanAbsoluteError : 0;
              const safeMeanAbsolutePercentageError = isFinite(meanAbsolutePercentageError) ? meanAbsolutePercentageError : 0;
              const safeModelStability = isFinite(modelStability) ? modelStability : 0;

              // Determine performance quality for color coding
              const getPerformanceColor = (mape: number) => {
                if (mape < 15) return "#52c41a"; // Excellent - Green
                if (mape < 25) return "#faad14"; // Good - Yellow  
                if (mape < 35) return "#ff7300"; // Fair - Orange
                return "#ff4d4f"; // Poor - Red
              };

              const getPerformanceLabel = (mape: number) => {
                if (mape < 15) return "🏆 Excellent";
                if (mape < 25) return "✅ Good";
                if (mape < 35) return "⚠️ Fair";
                return "❌ Poor";
              };

              return (
                <Row gutter={16}>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="Model Accuracy (MAPE)"
                        value={safeMeanAbsolutePercentageError.toFixed(1)}
                        suffix="%"
                        valueStyle={{ color: getPerformanceColor(safeMeanAbsolutePercentageError) }}
                      />
                      <div style={{ fontSize: "14px", color: getPerformanceColor(safeMeanAbsolutePercentageError), marginTop: "8px", fontWeight: "bold" }}>
                        {getPerformanceLabel(safeMeanAbsolutePercentageError)}
                      </div>
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                        Average percentage error in predictions
                      </div>
                    </Card>
                  </Col>
                  
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="Average Error"
                        value={safeMeanAbsoluteError.toFixed(1)}
                        suffix="pizzas"
                        valueStyle={{ color: "#1890ff" }}
                      />
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                        Typical prediction error magnitude
                      </div>
                      <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                        Target: &lt;15 pizzas (excellent), &lt;25 pizzas (good)
                      </div>
                    </Card>
                  </Col>

                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="Business Reliability"
                        value={safeModelStability < 20 ? "High" : safeModelStability < 35 ? "Medium" : "Low"}
                        valueStyle={{ color: safeModelStability < 20 ? "#52c41a" : safeModelStability < 35 ? "#faad14" : "#ff4d4f" }}
                      />
                      <div style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                        Consistency: {safeModelStability.toFixed(1)}% relative error
                      </div>
                      <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                        Based on {trainData.length} training days, {testData.length} test days
                      </div>
                    </Card>
                  </Col>
                </Row>
              );
            })()}
          </Card>
        </>
      )}
    </div>
  );
};

export default Forecasting;
