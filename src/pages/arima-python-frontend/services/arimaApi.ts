/**
 * ARIMA API Service
 * Handles communication with the ARIMA Python backend
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
  timeout: 300000, // 5 minutes for training
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error("API Response Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const arimaApi = {
  /**
   * Check backend service status
   */
  async checkStatus(): Promise<BackendStatus> {
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
        message: "Backend service is not available",
      };
    }
  },

  /**
   * Upload CSV file and start ARIMA training
   */
  async uploadAndTrain(
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
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Upload and training failed"
      );
    }
  },

  /**
   * Get forecast results for a specific session
   */
  async getForecast(sessionId: string): Promise<APIResponse<TrainingSession>> {
    try {
      const response = await api.get(`/forecast/${sessionId}`);

      return {
        status: "success",
        session_id: response.data.session_id,
        data: response.data.data,
      };
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to retrieve forecast"
      );
    }
  },

  /**
   * List all training sessions
   */
  async listSessions(): Promise<APIResponse<SessionSummary[]>> {
    try {
      const response = await api.get("/sessions");

      return {
        status: "success",
        data: response.data.sessions,
      };
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to list sessions"
      );
    }
  },

  /**
   * Download forecast results as JSON
   */
  async downloadResults(sessionId: string): Promise<Blob> {
    try {
      const response = await api.get(`/download/${sessionId}`, {
        responseType: "blob",
      });

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to download results"
      );
    }
  },

  /**
   * Retrain model with different parameters
   */
  async retrainModel(
    sessionId: string,
    newConfig: Partial<TrainingConfig>
  ): Promise<APIResponse<TrainingSession>> {
    try {
      const response = await api.post(`/retrain/${sessionId}`, newConfig);

      return {
        status: "success",
        session_id: response.data.session_id,
        message: response.data.message,
        data: response.data.data,
      };
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error ||
          error.message ||
          "Failed to retrain model"
      );
    }
  },

  /**
   * Parse CSV file for preview (client-side)
   */
  async parseCSVPreview(file: File, maxRows: number = 10): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split("\n").filter((line) => line.trim());

          if (lines.length < 2) {
            reject(
              new Error("CSV file must have at least a header and one data row")
            );
            return;
          }

          const headers = lines[0]
            .split(",")
            .map((h) => h.trim().replace(/"/g, ""));
          const previewData = [];

          for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
            const values = lines[i]
              .split(",")
              .map((v) => v.trim().replace(/"/g, ""));
            const row: any = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || "";
            });

            previewData.push(row);
          }

          resolve(previewData);
        } catch (error) {
          reject(new Error("Failed to parse CSV file"));
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },

  /**
   * Validate CSV file structure
   */
  async validateCSV(file: File): Promise<{
    isValid: boolean;
    columns: string[];
    rowCount: number;
    errors: string[];
  }> {
    try {
      const preview = await this.parseCSVPreview(file, 100);
      const errors: string[] = [];

      if (preview.length === 0) {
        errors.push("CSV file is empty");
      }

      const columns = Object.keys(preview[0] || {});

      if (columns.length < 2) {
        errors.push("CSV file must have at least 2 columns (date and value)");
      }

      // Check for potential date columns
      const dateColumns = columns.filter((col) =>
        /date|time|timestamp/i.test(col)
      );

      if (dateColumns.length === 0) {
        errors.push(
          "No obvious date column found. Please ensure you have a date/time column."
        );
      }

      // Check for potential numeric columns
      const numericColumns = columns.filter((col) => {
        const sampleValues = preview.slice(0, 5).map((row) => row[col]);
        return sampleValues.some((val) => !isNaN(parseFloat(val)));
      });

      if (numericColumns.length === 0) {
        errors.push("No numeric columns found for forecasting.");
      }

      return {
        isValid: errors.length === 0,
        columns,
        rowCount: preview.length,
        errors,
      };
    } catch (error: any) {
      return {
        isValid: false,
        columns: [],
        rowCount: 0,
        errors: [error.message],
      };
    }
  },
};

export default arimaApi;
