import React from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Tag,
  Descriptions,
  Progress,
  Tooltip,
} from "antd";
import {
  TrophyOutlined,
  // TargetOutlined,
  LineChartOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { PerformanceMetrics, TrainingResult, ARIMAOrder } from "../types";

const { Title, Text } = Typography;

interface PerformanceMetricsProps {
  metrics: PerformanceMetrics;
  modelInfo: TrainingResult;
}

export const PerformanceMetricsDisplay: React.FC<PerformanceMetricsProps> = ({
  metrics,
  modelInfo,
}) => {
  // Helper function to get metric interpretation
  const getMetricInterpretation = (
    metric: keyof PerformanceMetrics,
    value: number
  ) => {
    switch (metric) {
      case "r2":
        if (value >= 0.9) return { level: "excellent", color: "#52c41a" };
        if (value >= 0.7) return { level: "good", color: "#1890ff" };
        if (value >= 0.5) return { level: "fair", color: "#faad14" };
        return { level: "poor", color: "#ff4d4f" };

      case "mape":
        if (value === null || value === undefined)
          return { level: "unknown", color: "#d9d9d9" };
        if (value <= 10) return { level: "excellent", color: "#52c41a" };
        if (value <= 20) return { level: "good", color: "#1890ff" };
        if (value <= 50) return { level: "fair", color: "#faad14" };
        return { level: "poor", color: "#ff4d4f" };

      case "directional_accuracy":
        if (value >= 80) return { level: "excellent", color: "#52c41a" };
        if (value >= 60) return { level: "good", color: "#1890ff" };
        if (value >= 40) return { level: "fair", color: "#faad14" };
        return { level: "poor", color: "#ff4d4f" };

      default:
        return { level: "neutral", color: "#1890ff" };
    }
  };

  // Helper function to format ARIMA order
  const formatARIMAOrder = (order: ARIMAOrder) => {
    return `ARIMA(${order.p}, ${order.d}, ${order.q})`;
  };

  // Calculate overall model score
  const calculateOverallScore = () => {
    let score = 0;
    let factors = 0;

    // R² score (0-100)
    if (metrics.r2 >= 0) {
      score += Math.max(0, metrics.r2 * 100);
      factors++;
    }

    // MAPE score (inverted, lower is better)
    if (metrics.mape && metrics.mape > 0) {
      score += Math.max(0, 100 - metrics.mape);
      factors++;
    }

    // Directional accuracy
    if (metrics.directional_accuracy >= 0) {
      score += metrics.directional_accuracy;
      factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 0;
  };

  const overallScore = calculateOverallScore();
  const scoreInterpretation = getMetricInterpretation("r2", overallScore / 100);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* Overall Performance Card */}
      <Card
        title={
          <Space>
            <TrophyOutlined />
            <span>Model Performance Summary</span>
          </Space>
        }
      >
        <Row gutter={24} align="middle">
          <Col span={8}>
            <div style={{ textAlign: "center" }}>
              <Progress
                type="circle"
                percent={overallScore}
                strokeColor={scoreInterpretation.color}
                size={120}
                format={(percent) => (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: "bold" }}>
                      {percent}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>Score</div>
                  </div>
                )}
              />
              <div style={{ marginTop: 8 }}>
                <Tag color={scoreInterpretation.color} style={{ fontSize: 14 }}>
                  {scoreInterpretation.level.toUpperCase()}
                </Tag>
              </div>
            </div>
          </Col>

          <Col span={16}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Model Type">
                <Space>
                  <Tag color="blue">{formatARIMAOrder(modelInfo.order)}</Tag>
                  <Tooltip title="AutoRegressive Integrated Moving Average model with automatically selected parameters">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              </Descriptions.Item>

              <Descriptions.Item label="Sample Size">
                <Text strong>{metrics.sample_size.toLocaleString()}</Text> data
                points
              </Descriptions.Item>

              <Descriptions.Item label="AIC Score">
                <Text>{modelInfo.aic.toFixed(2)}</Text>
                <Tooltip title="Akaike Information Criterion - lower values indicate better model fit">
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </Descriptions.Item>

              <Descriptions.Item label="BIC Score">
                <Text>{modelInfo.bic.toFixed(2)}</Text>
                <Tooltip title="Bayesian Information Criterion - lower values indicate better model fit">
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              </Descriptions.Item>

              <Descriptions.Item label="Stationarity">
                <Tag
                  color={
                    modelInfo.stationarity_test.is_stationary
                      ? "green"
                      : "orange"
                  }
                >
                  {modelInfo.stationarity_test.interpretation}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Training Date">
                <Text>
                  {new Date(modelInfo.training_date).toLocaleString()}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Detailed Metrics */}
      <Card
        title={
          <Space>
            <span>Detailed Performance Metrics</span>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small" style={{ backgroundColor: "#f6f6f6" }}>
              <Statistic
                title={
                  <Space>
                    <span>R² Score</span>
                    <Tooltip title="Coefficient of determination - measures how well the model explains variance (1.0 = perfect fit)">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                value={metrics.r2}
                precision={3}
                valueStyle={{
                  color: getMetricInterpretation("r2", metrics.r2).color,
                  fontSize: 20,
                }}
                prefix={<LineChartOutlined />}
              />
              <div style={{ marginTop: 8 }}>
                <Tag color={getMetricInterpretation("r2", metrics.r2).color}>
                  {getMetricInterpretation("r2", metrics.r2).level}
                </Tag>
              </div>
            </Card>
          </Col>

          <Col span={6}>
            <Card size="small" style={{ backgroundColor: "#f6f6f6" }}>
              <Statistic
                title={
                  <Space>
                    <span>RMSE</span>
                    <Tooltip title="Root Mean Square Error - average prediction error in original units">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                value={metrics.rmse}
                precision={3}
                valueStyle={{ color: "#1890ff", fontSize: 20 }}
                // prefix={<TargetOutlined />}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Lower is better</Text>
              </div>
            </Card>
          </Col>

          <Col span={6}>
            <Card size="small" style={{ backgroundColor: "#f6f6f6" }}>
              <Statistic
                title={
                  <Space>
                    <span>MAPE</span>
                    <Tooltip title="Mean Absolute Percentage Error - average percentage error">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                value={metrics.mape || 0}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: metrics.mape
                    ? getMetricInterpretation("mape", metrics.mape).color
                    : "#d9d9d9",
                  fontSize: 20,
                }}
                prefix={<ThunderboltOutlined />}
              />
              <div style={{ marginTop: 8 }}>
                {metrics.mape ? (
                  <Tag
                    color={getMetricInterpretation("mape", metrics.mape).color}
                  >
                    {getMetricInterpretation("mape", metrics.mape).level}
                  </Tag>
                ) : (
                  <Tag color="default">N/A</Tag>
                )}
              </div>
            </Card>
          </Col>

          <Col span={6}>
            <Card size="small" style={{ backgroundColor: "#f6f6f6" }}>
              <Statistic
                title={
                  <Space>
                    <span>Direction Accuracy</span>
                    <Tooltip title="Percentage of correct trend direction predictions">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                value={metrics.directional_accuracy}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: getMetricInterpretation(
                    "directional_accuracy",
                    metrics.directional_accuracy
                  ).color,
                  fontSize: 20,
                }}
                prefix={<CheckCircleOutlined />}
              />
              <div style={{ marginTop: 8 }}>
                <Tag
                  color={
                    getMetricInterpretation(
                      "directional_accuracy",
                      metrics.directional_accuracy
                    ).color
                  }
                >
                  {
                    getMetricInterpretation(
                      "directional_accuracy",
                      metrics.directional_accuracy
                    ).level
                  }
                </Tag>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Additional Metrics Row */}
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Mean Absolute Error (MAE)"
                value={metrics.mae}
                precision={3}
                valueStyle={{ color: "#722ed1" }}
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Mean Actual Value"
                value={metrics.mean_actual}
                precision={2}
                valueStyle={{ color: "#13c2c2" }}
              />
            </Card>
          </Col>

          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Mean Predicted Value"
                value={metrics.mean_predicted}
                precision={2}
                valueStyle={{ color: "#eb2f96" }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Model Details */}
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>Model Technical Details</span>
          </Space>
        }
        size="small"
      >
        <Descriptions column={3} size="small" bordered>
          <Descriptions.Item label="AR Parameters">
            {modelInfo.model_params.ar_params.length > 0
              ? modelInfo.model_params.ar_params
                  .map((p) => p.toFixed(4))
                  .join(", ")
              : "None"}
          </Descriptions.Item>

          <Descriptions.Item label="MA Parameters">
            {modelInfo.model_params.ma_params.length > 0
              ? modelInfo.model_params.ma_params
                  .map((p) => p.toFixed(4))
                  .join(", ")
              : "None"}
          </Descriptions.Item>

          <Descriptions.Item label="Sigma²">
            {modelInfo.model_params.sigma2.toFixed(6)}
          </Descriptions.Item>

          <Descriptions.Item label="Log Likelihood">
            {modelInfo.log_likelihood.toFixed(2)}
          </Descriptions.Item>

          <Descriptions.Item label="ADF P-value">
            {modelInfo.stationarity_test.p_value.toFixed(6)}
          </Descriptions.Item>

          <Descriptions.Item label="Data Mean">
            {modelInfo.data_summary.mean.toFixed(3)}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
};
