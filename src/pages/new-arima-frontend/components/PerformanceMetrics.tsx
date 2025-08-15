/**
 * Performance Metrics Component
 * Displays model performance metrics and interpretation
 */
import React from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Alert,
  Space,
  Typography,
  Tooltip,
  Tag,
  Divider,
} from 'antd';
import {
  TrophyOutlined,
  DashboardOutlined,
  BarChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { PerformanceMetrics, ModelInfo } from '../types';

const { Title, Text } = Typography;

interface PerformanceMetricsProps {
  metrics: PerformanceMetrics;
  modelInfo: ModelInfo;
}

const PerformanceMetricsComponent: React.FC<PerformanceMetricsProps> = ({
  metrics,
  modelInfo,
}) => {
  // Helper function to get metric interpretation
  const getMetricInterpretation = (metricName: string, value: number) => {
    switch (metricName) {
      case 'mape':
        if (value < 10) return { level: 'excellent', color: 'green', text: 'Excellent' };
        if (value < 20) return { level: 'good', color: 'blue', text: 'Good' };
        if (value < 30) return { level: 'fair', color: 'orange', text: 'Fair' };
        return { level: 'poor', color: 'red', text: 'Poor' };
      
      case 'mae':
        // MAE interpretation based on the mean actual value (relative error)
        const relativeMAE = (value / metrics.mean_actual) * 100;
        if (relativeMAE < 10) return { level: 'excellent', color: 'green', text: 'Excellent' };
        if (relativeMAE < 20) return { level: 'good', color: 'blue', text: 'Good' };
        if (relativeMAE < 30) return { level: 'fair', color: 'orange', text: 'Fair' };
        return { level: 'poor', color: 'red', text: 'Poor' };
      
      case 'rmse':
        // RMSE interpretation based on the mean actual value (relative error)
        const relativeRMSE = (value / metrics.mean_actual) * 100;
        if (relativeRMSE < 15) return { level: 'excellent', color: 'green', text: 'Excellent' };
        if (relativeRMSE < 25) return { level: 'good', color: 'blue', text: 'Good' };
        if (relativeRMSE < 35) return { level: 'fair', color: 'orange', text: 'Fair' };
        return { level: 'poor', color: 'red', text: 'Poor' };
      
      default:
        return { level: 'unknown', color: 'gray', text: 'Unknown' };
    }
  };

  // Calculate overall model grade based on MAPE, MAE, and RMSE
  const getOverallGrade = () => {
    // MAPE score (most important for forecasting)
    const mapeScore = metrics.mape < 10 ? 4 : metrics.mape < 20 ? 3 : metrics.mape < 30 ? 2 : 1;
    
    // MAE score (relative to mean)
    const relativeMAE = (metrics.mae / metrics.mean_actual) * 100;
    const maeScore = relativeMAE < 10 ? 4 : relativeMAE < 20 ? 3 : relativeMAE < 30 ? 2 : 1;
    
    // RMSE score (relative to mean)
    const relativeRMSE = (metrics.rmse / metrics.mean_actual) * 100;
    const rmseScore = relativeRMSE < 15 ? 4 : relativeRMSE < 25 ? 3 : relativeRMSE < 35 ? 2 : 1;
    
    // Weighted average (MAPE has higher weight)
    const avgScore = (mapeScore * 0.5 + maeScore * 0.25 + rmseScore * 0.25);
    
    if (avgScore >= 3.5) return { grade: 'A', color: 'green', description: 'Excellent' };
    if (avgScore >= 2.5) return { grade: 'B', color: 'blue', description: 'Good' };
    if (avgScore >= 1.5) return { grade: 'C', color: 'orange', description: 'Fair' };
    return { grade: 'D', color: 'red', description: 'Poor' };
  };

  const overallGrade = getOverallGrade();
  const mapeInterpretation = getMetricInterpretation('mape', metrics.mape);
  const maeInterpretation = getMetricInterpretation('mae', metrics.mae);
  const rmseInterpretation = getMetricInterpretation('rmse', metrics.rmse);

  return (
    <Card
      title={
        <Space>
          <DashboardOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Model Performance Analysis
          </Title>
        </Space>
      }
      size="default"
    >
      {/* Overall Grade */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            size="small"
            style={{
              background: `linear-gradient(135deg, ${overallGrade.color}20, ${overallGrade.color}10)`,
              border: `1px solid ${overallGrade.color}`,
            }}
          >
            <Row align="middle" justify="center">
              <Col>
                <Space size="large" align="center">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: 48, 
                      fontWeight: 'bold', 
                      color: overallGrade.color,
                      lineHeight: 1 
                    }}>
                      {overallGrade.grade}
                    </div>
                    <Text type="secondary">Overall Grade</Text>
                  </div>
                  <Divider type="vertical" style={{ height: 60 }} />
                  <div>
                    <Title level={5} style={{ margin: 0, color: overallGrade.color }}>
                      {overallGrade.description} Performance
                    </Title>
                    <Text type="secondary">
                      ARIMA({modelInfo.order.p}, {modelInfo.order.d}, {modelInfo.order.q})
                    </Text>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Key Metrics */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title={
                <Space>
                  <span>MAPE (Accuracy)</span>
                  <Tooltip title="Mean Absolute Percentage Error - Lower is better">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              value={metrics.mape}
              precision={1}
              suffix="%"
              valueStyle={{ color: mapeInterpretation.color }}
            />
            <Tag color={mapeInterpretation.color} style={{ marginTop: 8 }}>
              {mapeInterpretation.text}
            </Tag>
            <Progress
              percent={Math.max(0, 100 - metrics.mape * 2)}
              strokeColor={mapeInterpretation.color}
              showInfo={false}
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title={
                <Space>
                  <span>MAE (Absolute Error)</span>
                  <Tooltip title="Mean Absolute Error - Lower is better">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              value={metrics.mae}
              precision={2}
              valueStyle={{ color: maeInterpretation.color }}
            />
            <Tag color={maeInterpretation.color} style={{ marginTop: 8 }}>
              {maeInterpretation.text}
            </Tag>
            <Progress
              percent={Math.max(0, Math.min(100, 100 - (metrics.mae / metrics.mean_actual) * 100 * 2))}
              strokeColor={maeInterpretation.color}
              showInfo={false}
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        
        <Col span={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title={
                <Space>
                  <span>RMSE (Root Mean Square)</span>
                  <Tooltip title="Root Mean Square Error - Lower is better">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              value={metrics.rmse}
              precision={2}
              valueStyle={{ color: rmseInterpretation.color }}
            />
            <Tag color={rmseInterpretation.color} style={{ marginTop: 8 }}>
              {rmseInterpretation.text}
            </Tag>
            <Progress
              percent={Math.max(0, Math.min(100, 100 - (metrics.rmse / metrics.mean_actual) * 100 * 1.5))}
              strokeColor={rmseInterpretation.color}
              showInfo={false}
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Model Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card size="small" title="📈 Model Summary">
            <Row gutter={16}>
              <Col span={6}>
                <Text type="secondary">Model Type:</Text>
                <br />
                <Text strong>ARIMA({modelInfo.order.p}, {modelInfo.order.d}, {modelInfo.order.q})</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">AIC Score:</Text>
                <br />
                <Text strong>{modelInfo.aic.toFixed(2)}</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">Mean Square Error:</Text>
                <br />
                <Text strong>{metrics.mse.toFixed(2)}</Text>
              </Col>
              <Col span={6}>
                <Text type="secondary">Sample Size:</Text>
                <br />
                <Text strong>{metrics.sample_size} observations</Text>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Interpretation and Recommendations */}
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Performance Interpretation */}
        {metrics.mape > 30 && (
          <Alert
            message="High Prediction Error"
            description="MAPE is above 30%, indicating significant forecasting errors. The model may not be suitable for critical business decisions without additional validation."
            type="warning"
            showIcon
          />
        )}
        
        {(metrics.mae / metrics.mean_actual) * 100 > 50 && (
          <Alert
            message="Large Absolute Errors"
            description="Mean Absolute Error is more than 50% of the average sales value. Consider investigating data quality or model parameters."
            type="warning"
            showIcon
          />
        )}

        {/* Positive feedback */}
        {metrics.mape < 20 && (metrics.mae / metrics.mean_actual) * 100 < 25 && (
          <Alert
            message="Good Model Performance"
            description="The model shows acceptable performance for business forecasting with MAPE below 20% and reasonable error margins."
            type="success"
            showIcon
          />
        )}

        {/* Model insights */}
        <Alert
          message="Model Analysis"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>
                <strong>Model Type:</strong> ARIMA({modelInfo.order.p}, {modelInfo.order.d}, {modelInfo.order.q}) - 
                {modelInfo.order.p + modelInfo.order.q > 6 ? ' High complexity' : ' Moderate complexity'}
              </li>
              <li>
                <strong>Data Stationarity:</strong> {modelInfo.stationarity_test.interpretation} 
                (p-value: {modelInfo.stationarity_test.p_value.toExponential(2)})
              </li>
              <li>
                <strong>Average Sales:</strong> Predicted {metrics.mean_predicted.toFixed(2)} vs Actual {metrics.mean_actual.toFixed(2)}
              </li>
              <li>
                <strong>Sample Size:</strong> {metrics.sample_size} observations used for validation
              </li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  );
};

export default PerformanceMetricsComponent;
