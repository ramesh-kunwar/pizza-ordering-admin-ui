import React, { useState, useEffect } from 'react';
import {
  Layout,
  Typography,
  Space,
  Alert,
  Tabs,
  Card,
  Button,
  Row,
  Col,
  Spin,
  message,
  Badge,
  Divider
} from 'antd';
import {
  RobotOutlined,
  LineChartOutlined,
  UploadOutlined,
  BarChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { CSVUploader } from './components/CSVUploader';
import { PerformanceMetricsDisplay } from './components/PerformanceMetrics';
import { ForecastChart } from './components/ForecastChart';
import { SessionManager } from './components/SessionManager';
import { arimaApi } from './services/arimaApi';
import type { TrainingSession, BackendStatus } from './types';

const { Title, Paragraph, Text } = Typography;
const { Content } = Layout;

export const ARIMAForecastingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'sessions' | 'results' | 'charts'>('upload');
  const [trainingSession, setTrainingSession] = useState<TrainingSession | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ status: 'loading' });
  const [loading, setLoading] = useState(false);

  // Check backend status on component mount
  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const status = await arimaApi.checkStatus();
      setBackendStatus(status);
      
      if (status.status === 'online') {
        message.success('ARIMA backend service is online');
      } else {
        message.error('ARIMA backend service is offline');
      }
    } catch (error) {
      console.error('Backend status check failed:', error);
      setBackendStatus({
        status: 'offline',
        message: 'Failed to connect to backend service'
      });
    }
  };

  const handleTrainingComplete = (session: TrainingSession) => {
    setTrainingSession(session);
    setActiveTab('results');
    message.success('Training completed! View your results in the Results tab.');
  };

  const handleSessionLoad = (session: TrainingSession) => {
    setTrainingSession(session);
    setActiveTab('results');
    message.success('Session loaded successfully! All data restored.');
  };

  const handleDownloadResults = async () => {
    if (!trainingSession) {
      message.error('No training session to download');
      return;
    }
    
    try {
      setLoading(true);
      const blob = await arimaApi.downloadResults(trainingSession.session_id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `arima_forecast_results_${trainingSession.session_id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Results downloaded successfully!');
    } catch (error: any) {
      console.error('Download failed:', error);
      message.error(`Download failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setTrainingSession(null);
    setActiveTab('upload');
    message.info('Session reset. You can now upload a new dataset.');
  };

  // Tab items configuration
  const tabItems = [
    {
      key: 'upload',
      label: (
        <Space>
          <UploadOutlined />
          <span>Data Upload & Training</span>
        </Space>
      ),
      children: (
        <CSVUploader onTrainingComplete={handleTrainingComplete} />
      )
    },
    {
      key: 'sessions',
      label: (
        <Space>
          <ReloadOutlined />
          <span>Saved Sessions</span>
        </Space>
      ),
      children: (
        <SessionManager 
          onSessionSelect={handleSessionLoad}
          currentSessionId={trainingSession?.session_id}
        />
      )
    },
    {
      key: 'results',
      label: (
        <Space>
          <BarChartOutlined />
          <span>Performance Results</span>
          {trainingSession && <Badge status="success" />}
        </Space>
      ),
      children: trainingSession ? (
        <PerformanceMetricsDisplay
          metrics={trainingSession.performance_metrics}
          modelInfo={trainingSession.model_info}
        />
      ) : (
        <Card>
          <Alert
            message="No Training Results Available"
            description="Please complete the training process in the Data Upload tab first."
            type="info"
            showIcon
          />
        </Card>
      ),
      disabled: !trainingSession
    },
    {
      key: 'charts',
      label: (
        <Space>
          <LineChartOutlined />
          <span>Forecast Visualization</span>
          {trainingSession && <Badge status="success" />}
        </Space>
      ),
      children: trainingSession ? (
        <ForecastChart
          session={trainingSession}
          onDownload={handleDownloadResults}
        />
      ) : (
        <Card>
          <Alert
            message="No Forecast Data Available"
            description="Please complete the training process in the Data Upload tab first."
            type="info"
            showIcon
          />
        </Card>
      ),
      disabled: !trainingSession
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ padding: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <Card>
            <Row justify="space-between" align="middle">
              <Col>
                <Space direction="vertical" size="small">
                  <Title level={2} style={{ margin: 0 }}>
                    <Space>
                      <RobotOutlined style={{ color: '#F65f42' }} />
                      ARIMA Forecasting System
                    </Space>
                  </Title>
                  <Paragraph style={{ margin: 0, color: '#666' }}>
                    Complete end-to-end ARIMA-based time series forecasting with Python backend and React frontend
                  </Paragraph>
                </Space>
              </Col>
              
              <Col>
                <Space>
                  {/* Backend Status */}
                  <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                    <Space>
                      <Text strong>Backend Status:</Text>
                      {backendStatus.status === 'online' ? (
                        <Badge status="success" text="Online" />
                      ) : backendStatus.status === 'offline' ? (
                        <Badge status="error" text="Offline" />
                      ) : (
                        <Badge status="processing" text="Loading..." />
                      )}
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={checkBackendStatus}
                        loading={loading}
                      >
                        Refresh
                      </Button>
                    </Space>
                  </Card>
                  
                  {/* Action Buttons */}
                  {trainingSession && (
                    <Space>
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleDownloadResults}
                        loading={loading}
                      >
                        Download Results
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={resetSession}
                      >
                        New Session
                      </Button>
                    </Space>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Backend Status Alert */}
          {backendStatus.status === 'offline' && (
            <Alert
              message="Backend Service Offline"
              description={
                <Space direction="vertical">
                  <Text>The ARIMA Python backend service is not available. Please ensure:</Text>
                  <ul>
                    <li>The backend server is running on port 8080</li>
                    <li>Run <code>cd arima-backend && ./start.sh</code> to start the service</li>
                    <li>Check your network connection</li>
                  </ul>
                </Space>
              }
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              action={
                <Button
                  size="small"
                  danger
                  onClick={checkBackendStatus}
                  loading={loading}
                >
                  Retry Connection
                </Button>
              }
            />
          )}

          {/* Session Info */}
          {trainingSession && (
            <Card size="small">
              <Row gutter={16} align="middle">
                <Col>
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text strong>Active Session:</Text>
                    <Text code>{trainingSession.session_id}</Text>
                  </Space>
                </Col>
                <Col>
                  <Space split={<Divider type="vertical" />}>
                    <Text>File: <strong>{trainingSession.filename}</strong></Text>
                    <Text>Model: <strong>ARIMA({trainingSession.model_info.order.p}, {trainingSession.model_info.order.d}, {trainingSession.model_info.order.q})</strong></Text>
                    <Text>R²: <strong>{trainingSession.performance_metrics.r2.toFixed(3)}</strong></Text>
                    <Text>RMSE: <strong>{trainingSession.performance_metrics.rmse.toFixed(3)}</strong></Text>
                  </Space>
                </Col>
              </Row>
            </Card>
          )}

          {/* Main Content Tabs */}
          <Card style={{ minHeight: 600 }}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as any)}
              items={tabItems}
              size="large"
              type="card"
            />
          </Card>

          {/* Footer Info */}
          <Card size="small">
            <Row justify="center">
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Final Year Project - ARIMA Forecasting System | 
                  Frontend: React + Ant Design | 
                  Backend: Python + Flask + Statsmodels | 
                  Built for academic demonstration
                </Text>
              </Col>
            </Row>
          </Card>
        </Space>
      </Content>
    </Layout>
  );
};
