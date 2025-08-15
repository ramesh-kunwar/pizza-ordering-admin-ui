import React, { useState, useCallback } from "react";
import {
  Layout,
  Card,
  Space,
  Typography,
  Button,
  Alert,
  Spin,
  message,
  Row,
  Col,
  Steps,
  theme,
  Flex,

} from "antd";
import { UploadOutlined, BarChartOutlined, DeleteOutlined } from "@ant-design/icons";

// Components
import CSVUploader from "./components/CSVUploader";
import ForecastChart from "./components/ForecastChart";
import ForecastTable from "./components/ForecastTable";
import PerformanceMetricsComponent from "./components/PerformanceMetrics";

// Services and Types
import { newArimaApi } from "./services/arimaApi";
import type { TrainingSession, TrainingConfig, BackendStatus } from "./types";

// Styles
// import './styles.css';

const { Content } = Layout;
const { Title, Text } = Typography;
// Steps component used directly

const NewArimaForecastingDashboard: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // Local storage keys
  const STORAGE_KEYS = {
    SESSION: 'arima_training_session',
    CURRENT_STEP: 'arima_current_step',
    FORECAST_PERIOD: 'arima_forecast_period'
  };

  // Helper function to safely get from localStorage
  const getFromLocalStorage = useCallback((key: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return defaultValue;
      
      if (key === STORAGE_KEYS.SESSION) {
        return JSON.parse(saved);
      } else {
        return parseInt(saved, 10) || defaultValue;
      }
    } catch (error) {
      console.warn(`Error reading from localStorage key "${key}":`, error);
      return defaultValue;
    }
  }, [STORAGE_KEYS]);

  // Initialize state from localStorage with error handling
  const [currentStep, setCurrentStep] = useState(() => 
    getFromLocalStorage(STORAGE_KEYS.CURRENT_STEP, 0)
  );
  
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(
    null
  );
  
  const [session, setSession] = useState<TrainingSession | null>(() => 
    getFromLocalStorage(STORAGE_KEYS.SESSION, null)
  );
  
  const [forecastPeriod, setForecastPeriod] = useState<number>(() => 
    getFromLocalStorage(STORAGE_KEYS.FORECAST_PERIOD, 30)
  );
  
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Helper function to safely save to localStorage
  const saveToLocalStorage = useCallback((key: string, value: any) => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else if (typeof value === 'object') {
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        localStorage.setItem(key, value.toString());
      }
    } catch (error) {
      console.warn(`Error saving to localStorage key "${key}":`, error);
    }
  }, []);

  // Save to localStorage when state changes
  React.useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.CURRENT_STEP, currentStep);
  }, [currentStep, saveToLocalStorage, STORAGE_KEYS.CURRENT_STEP]);

  React.useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.SESSION, session);
  }, [session, saveToLocalStorage, STORAGE_KEYS.SESSION]);

  React.useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.FORECAST_PERIOD, forecastPeriod);
  }, [forecastPeriod, saveToLocalStorage, STORAGE_KEYS.FORECAST_PERIOD]);

  // Check backend status on component mount
  React.useEffect(() => {
    checkBackendHealth();
    
    // Show restored session message if data exists
    const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (savedSession && currentStep === 1) {
      message.success("Previous session restored! 🔄", 3);
    }
  }, []);



  // Backend health check
  const checkBackendHealth = async () => {
    try {
      const status = await newArimaApi.checkHealth();
      setBackendStatus(status);

      if (status.status === "offline") {
        setError(
          "ARIMA backend service is not available. Please ensure the service is running on localhost:8080."
        );
      }
    } catch (error) {
      setError("Failed to check backend status");
    }
  };

  // Handle file upload and forecasting
  const handleFileUpload = useCallback(
    async (file: File, config: TrainingConfig) => {
      setLoading(true);
      setError(null);

      // Create abort controller for cancellation
      const controller = new AbortController();
      setAbortController(controller);

      try {
        message.loading(
          "Training ARIMA model... This may take 1-2 minutes.",
          0
        );

        const response = await newArimaApi.uploadAndForecast(file, config);

        message.destroy();

        if (response.status === "success" && response.data) {
          setSession(response.data);
          setCurrentStep(1);
          message.success("Model trained successfully! 🎉");
        } else {
          throw new Error(response.error || "Upload failed");
        }
      } catch (error: any) {
        message.destroy();

        if (error.name === "AbortError") {
          message.info("Training cancelled by user");
        } else {
          setError(error.message);
          message.error(
            "Training failed: " + (error.message || "Unknown error")
          );
        }
      } finally {
        setLoading(false);
        setAbortController(null);
      }
    },
    []
  );

  // Handle cancellation
  const handleCancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
      message.info("Cancelling training...");
    }
  }, [abortController]);

  // Handle forecast period change
  const handleForecastPeriodChange = useCallback((period: number) => {
    setForecastPeriod(period);
  }, []);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!session) return;

    try {
      await newArimaApi.downloadForecastData(session.session_id);
      message.success("Forecast data downloaded successfully!");
    } catch (error: any) {
      message.error("Failed to download data");
    }
  }, [session]);

  // Reset to upload new file
  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setSession(null);
    setError(null);
    setForecastPeriod(30);
    // Clear localStorage
    saveToLocalStorage(STORAGE_KEYS.SESSION, null);
    saveToLocalStorage(STORAGE_KEYS.CURRENT_STEP, 0);
    saveToLocalStorage(STORAGE_KEYS.FORECAST_PERIOD, 30);
    message.info("Starting new analysis...");
  }, [STORAGE_KEYS, saveToLocalStorage]);

  // Add keyboard shortcut to clear localStorage (Ctrl+Shift+R)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        handleReset();
        message.info("Session reset and localStorage cleared! 🧹");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReset]);

  // Clear all persisted data
  const handleClearData = useCallback(() => {
    // Clear all localStorage keys
    Object.values(STORAGE_KEYS).forEach(key => {
      saveToLocalStorage(key, null);
    });
    
    // Reset all state
    setCurrentStep(0);
    setSession(null);
    setError(null);
    setForecastPeriod(30);
    
    message.success('Data cleared!');
  }, [STORAGE_KEYS, saveToLocalStorage]);



  // Render backend status
  const renderBackendStatus = () => {
    if (!backendStatus) return null;

    return (
      <Alert
        message={
          backendStatus.status === "online"
            ? "🟢 ARIMA Service Online"
            : "🔴 ARIMA Service Offline"
        }
        description={backendStatus.message}
        type={backendStatus.status === "online" ? "success" : "error"}
        showIcon
        style={{ marginBottom: 16 }}
        action={
          backendStatus.status === "offline" && (
            <Button size="small" onClick={checkBackendHealth}>
              Retry
            </Button>
          )
        }
      />
    );
  };

  // Render steps
  const renderSteps = () => (
    <Steps
      current={currentStep}
      style={{ marginBottom: 24 }}
      items={[
        {
          title: "Upload Data",
          icon: <UploadOutlined />,
        },
        {
          title: "View Results",
          icon: <BarChartOutlined />,
        },
      ]}
    />
  );

  // Render upload step
  const renderUploadStep = () => (
    <Row gutter={24}>
      <Col span={24}>
        <CSVUploader onFileUpload={handleFileUpload} loading={loading} />
      </Col>
    </Row>
  );

  // Render results step
  const renderResultsStep = () => {
    if (!session) return null;

    return (
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        {/* Action Bar */}
        <Card size="small">
          <Flex justify="space-between" align="center">
            <Space>
              <Title level={4} style={{ margin: 0 }}>
                📊 Forecast Results
              </Title>
              <Text type="secondary">
                Session: {session.session_id.substring(0, 8)}...
              </Text>
            </Space>
            <Space>
              <Button type="primary" onClick={handleReset}>
                New Forecast
              </Button>
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
                onClick={handleClearData}
              >
                Clear Data
              </Button>
            </Space>
          </Flex>
        </Card>

        {/* Performance Metrics */}
        <PerformanceMetricsComponent
          metrics={session.performance_metrics}
          modelInfo={session.model_info}
        />

        {/* Forecast Chart */}
        <ForecastChart
          session={session}
          forecastPeriod={forecastPeriod}
          onForecastPeriodChange={handleForecastPeriodChange}
          onDownload={handleDownload}
        />

        {/* Forecast Table */}
        <ForecastTable
          session={session}
          forecastPeriod={forecastPeriod}
        />
      </Space>
    );
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content style={{ padding: "0 24px" }}>
        {/* Main Content */}
        <div
          style={{
            padding: 24,
            background: colorBgContainer,
            borderRadius: 8,
            minHeight: "calc(100vh - 112px)",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={2} style={{ marginBottom: 8 }}>
                  🍕 Pizza Sales Forecasting
                </Title>
              </Col>
              <Col>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleClearData}
                  size="small"
                >
                  Clear Data
                </Button>
              </Col>
            </Row>
          </div>

          {/* Backend Status */}
          {renderBackendStatus()}

          {/* Error Message */}
          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Loading Indicator */}
          {loading && (
            <Card style={{ textAlign: "center", marginBottom: 24 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Title level={4}>Training ARIMA Model...</Title>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 16 }}
                >
                  This may take a few seconds to minutes.
                </Text>
                <Button
                  type="default"
                  onClick={handleCancel}
                  disabled={!abortController}
                >
                  Cancel Training
                </Button>
              </div>
            </Card>
          )}

          {/* Steps */}
          {!loading && renderSteps()}

          {/* Main Content Based on Step */}
          {!loading && (
            <>
              {currentStep === 0 && renderUploadStep()}
              {currentStep === 1 && renderResultsStep()}
            </>
          )}

          {/* Footer Info */}
          {!loading && (
            <Card
              size="small"
              style={{
                marginTop: 24,
                background: "#fafafa",
                borderStyle: "dashed",
              }}
            ></Card>
          )}
        </div>
      </Content>
    </Layout>
  );
};

export default NewArimaForecastingDashboard;
