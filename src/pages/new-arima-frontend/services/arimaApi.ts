/**
 * ARIMA API Service for New Frontend
 * Enhanced version with better error handling and typing
 */
import axios from "axios";
import type {
  APIResponse,
  TrainingSession,
  SessionSummary,
  BackendStatus,
  TrainingConfig,
} from "../types";

const API_BASE_URL = "http://localhost:8080";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout (reduced for better UX)
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 ARIMA API: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ ARIMA API: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("❌ API Response Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const newArimaApi = {
  /**
   * Check backend service health
   */
  async checkHealth(): Promise<BackendStatus> {
    try {
      const response = await api.get("/");
      return {
        status: "online",
        message: response.data.message,
        version: response.data.version,
      };
    } catch (error) {
      return {
        status: "offline",
        message: "ARIMA backend service is not available",
      };
    }
  },

  /**
   * Upload CSV and train ARIMA model
   */
  async uploadAndForecast(
    file: File,
    config: TrainingConfig
  ): Promise<APIResponse<TrainingSession>> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("date_column", config.dateColumn);
      formData.append("value_column", config.valueColumn);
      formData.append("test_size", config.testSize.toString());
      formData.append("forecast_horizon", config.forecastHorizon.toString());

      const response = await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return {
        status: "success",
        session_id: response.data.session_id,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      let errorMessage = "Failed to upload and train model";
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = "Training timeout: The model is taking too long to train. Try with less data or contact support.";
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.error || "Invalid data format or configuration";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error during training. Please try again or contact support.";
      } else if (error.message.includes('timeout')) {
        errorMessage = "Request timeout: Training is taking longer than expected. Please try with aggregated data.";
      } else {
        errorMessage = error.response?.data?.error || error.message || errorMessage;
      }
      
      return {
        status: "error",
        error: errorMessage,
      };
    }
  },

  /**
   * Get forecast results by session ID
   */
  async getForecastResults(sessionId: string): Promise<APIResponse<TrainingSession>> {
    try {
      const response = await api.get(`/forecast/${sessionId}`);

      return {
        status: "success",
        session_id: response.data.session_id,
        data: response.data.data,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to retrieve forecast results";
      
      return {
        status: "error",
        error: errorMessage,
      };
    }
  },

  /**
   * List all available sessions
   */
  async getAllSessions(): Promise<APIResponse<SessionSummary[]>> {
    try {
      const response = await api.get("/sessions");

      return {
        status: "success",
        data: response.data.sessions || [],
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch sessions";
      
      return {
        status: "error",
        error: errorMessage,
      };
    }
  },

  /**
   * Download forecast results as JSON
   */
  async downloadForecastData(sessionId: string): Promise<void> {
    try {
      const response = await api.get(`/download/${sessionId}`, {
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `arima_forecast_${sessionId}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error ||
        error.message ||
        "Failed to download forecast data"
      );
    }
  },

  /**
   * Parse CSV file for column preview
   */
  async parseCSVColumns(file: File): Promise<{
    columns: string[];
    preview: any[];
    rowCount: number;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split("\n").filter((line) => line.trim());

          if (lines.length < 2) {
            reject(new Error("CSV file must have header and data rows"));
            return;
          }

          // Parse header
          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().replace(/"/g, ""));

          // Parse preview data (first 5 rows)
          const preview = [];
          for (let i = 1; i < Math.min(lines.length, 6); i++) {
            const values = lines[i]
              .split(",")
              .map((v) => v.trim().replace(/"/g, ""));
            
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || "";
            });
            preview.push(row);
          }

          resolve({
            columns: headers,
            preview,
            rowCount: lines.length - 1, // Exclude header
          });
        } catch (error) {
          reject(new Error("Failed to parse CSV file"));
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },

  /**
   * Validate uploaded CSV file
   */
  async validateCSVFile(file: File): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      errors.push("File size must be less than 100MB");
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      errors.push("File must be a CSV file");
    }

    try {
      const { columns, rowCount } = await this.parseCSVColumns(file);

      // Check minimum columns
      if (columns.length < 2) {
        errors.push("CSV must have at least 2 columns (date and value)");
      }

      // Check minimum rows
      if (rowCount < 50) {
        warnings.push("Dataset has less than 50 rows. More data recommended for better forecasting");
      }

      // Check for date-like columns
      const dateColumns = columns.filter((col) =>
        /date|time|timestamp|day|month|year/i.test(col)
      );

      if (dateColumns.length === 0) {
        warnings.push("No obvious date column detected. Please verify date column selection");
      }

      // Check for numeric columns
      const numericColumns = columns.filter((col) =>
        /price|revenue|sales|quantity|amount|total|count|value/i.test(col)
      );

      if (numericColumns.length === 0) {
        warnings.push("No obvious numeric columns detected. Please verify value column selection");
      }

    } catch (error: any) {
      errors.push(error.message);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },
};

export default newArimaApi;
