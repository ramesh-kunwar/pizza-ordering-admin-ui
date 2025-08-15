/**
 * Performance Metrics Component
 * Displays simplified model performance metrics (MAPE, MAE, RMSE only)
 */
import React from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
} from 'antd';
import type { PerformanceMetrics, ModelInfo } from '../types';

const { Title } = Typography;

interface PerformanceMetricsProps {
  metrics: PerformanceMetrics;
  modelInfo: ModelInfo;
}

const PerformanceMetricsComponent: React.FC<PerformanceMetricsProps> = ({
  metrics,
  modelInfo,
}) => {
  return (
    <Card 
      title={
        <Title level={4} style={{ margin: 0 }}>
          📊 Performance Metrics
        </Title>
      }
      size="default"
    >
      <Row gutter={[24, 16]}>
        <Col xs={24} sm={8}>
          <Statistic
            title="MAPE (Mean Absolute Percentage Error)"
            value={metrics.mape}
            precision={2}
            suffix="%"
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        
        <Col xs={24} sm={8}>
          <Statistic
            title="MAE (Mean Absolute Error)"
            value={metrics.mae}
            precision={2}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        
        <Col xs={24} sm={8}>
          <Statistic
            title="RMSE (Root Mean Square Error)"
            value={metrics.rmse}
            precision={2}
            valueStyle={{ color: '#722ed1' }}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default PerformanceMetricsComponent;