/**
 * New ARIMA Forecasting Dashboard
 * Modern interface for pizza sales forecasting with enhanced UX
 */
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
  Breadcrumb,
  Steps,
  Divider,
  theme,
  Flex,
} from "antd";
import {
  HomeOutlined,
  UploadOutlined,
  BarChartOutlined,
  DashboardOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

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
const { Step } = Steps;

const NewArimaForecastingDashboard: React.FC = () => {
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(
    null
  );
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [forecastPeriod, setForecastPeriod] = useState<7 | 30>(30);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Check backend status on component mount
  React.useEffect(() => {
    checkBackendHealth();
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
  const handleForecastPeriodChange = useCallback((period: 7 | 30) => {
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
  }, []);

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
          description: "Upload CSV file and configure settings",
          icon: <UploadOutlined />,
        },
        {
          title: "View Results",
          description: "Analyze forecast and performance metrics",
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
              <Button onClick={handleDownload}>Download Data</Button>
              <Button type="primary" onClick={handleReset}>
                New Forecast
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
          onForecastPeriodChange={handleForecastPeriodChange}
        />
      </Space>
    );
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Content style={{ padding: "0 24px" }}>
        {/* Breadcrumb */}
        <Breadcrumb style={{ margin: "16px 0" }}>
          <Breadcrumb.Item>
            <Link to="/">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <DashboardOutlined />
            Dashboard
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <BarChartOutlined />
            ARIMA Forecasting
          </Breadcrumb.Item>
        </Breadcrumb>

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
            <Title level={2} style={{ marginBottom: 8 }}>
              🍕 Pizza Sales Forecasting
            </Title>
            <Text type="secondary" style={{ fontSize: 16 }}>
              Upload your sales data to generate accurate ARIMA forecasts with
              confidence intervals
            </Text>
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
                  This may take 1-2 minutes. The model is being optimized for
                  your data.
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
            >
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size="large">
                    <Text type="secondary">
                      💡 <strong>Tip:</strong> Ensure your CSV has date and
                      numeric columns
                    </Text>
                    <Text type="secondary">
                      📈 <strong>Best Practice:</strong> Use at least 100+ data
                      points for better accuracy
                    </Text>
                  </Space>
                </Col>
                <Col>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Powered by ARIMA Backend v1.0
                  </Text>
                </Col>
              </Row>
            </Card>
          )}
        </div>
      </Content>
    </Layout>
  );
};

export default NewArimaForecastingDashboard;
