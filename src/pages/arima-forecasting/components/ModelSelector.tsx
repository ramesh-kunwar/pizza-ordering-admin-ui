import React, { useState, useCallback } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Alert, 
  Collapse, 
  Form, 
  InputNumber, 
  Select,
  Divider,
  message 
} from 'antd';
import { 
  PlayCircleOutlined, 
  ThunderboltOutlined, 
  SettingOutlined,
  LoadingOutlined,
  CheckCircleOutlined 
} from '@ant-design/icons';
// import { ARIMAParams, ModelConfig, EDAResults, ProcessedDataset } from '../types/forecasting';
import { ARIMAModel } from '../lib/arima-model';
import type { ARIMAParams, ModelConfig, EDAResults, ProcessedDataset } from '../types/forecasting';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ModelSelectorProps {
  dataset: ProcessedDataset;
  edaResults: EDAResults | null;
  onModelTrained: (model: any) => void;
  isTraining: boolean;
  onTrainingStateChange: (state: { isTraining: boolean; progress: number; stage: string; error?: string }) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  dataset,
  edaResults,
  onModelTrained,
  isTraining,
  onTrainingStateChange
}) => {
  const [form] = Form.useForm();
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    params: { p: 1, d: 1, q: 1 },
    trainTestSplit: 0.8,
    forecastHorizon: 30,
    confidenceLevel: 0.95,
    maxIterations: 200,
    tolerance: 1e-6
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Get suggested parameters from EDA
  const getSuggestedParams = useCallback((): ARIMAParams => {
    if (!edaResults) return { p: 1, d: 1, q: 1 };

    const { timeSeriesFeatures, autocorrelation } = edaResults;
    
    // Conservative parameter selection to avoid overfitting
    // Start with simple model and let data drive complexity
    
    // Suggest d based on stationarity (max 2 to avoid over-differencing)
    let d = 1; // Default to 1 difference for most time series
    if (timeSeriesFeatures.stationarity.isStationary) {
      d = 0;
    } else if (timeSeriesFeatures.stationarity.adfPValue > 0.1) {
      d = 2; // Only if clearly non-stationary
    }
    
    // Conservative p and q selection (start simple)
    const dataLength = dataset.timeSeries?.length || 0;
    
    // For small datasets, use minimal parameters
    if (dataLength < 50) {
      return { p: 1, d: Math.min(d, 1), q: 0 };
    }
    
    // For larger datasets, allow more complexity but stay conservative
    const p = Math.min(autocorrelation.significantLags.length > 0 ? 1 : 0, 2);
    const q = Math.min(autocorrelation.significantLags.length > 2 ? 1 : 0, 1);

    return { p: Math.max(p, 1), d, q: Math.max(q, 0) };
  }, [edaResults, dataset]);

  const trainModel = async () => {
    if (!dataset.timeSeries || dataset.timeSeries.length < 30) {
      onTrainingStateChange({
        isTraining: false,
        progress: 0,
        stage: 'error',
        error: 'Insufficient data for model training (minimum 30 data points required)'
      });
      message.error('Insufficient data for training');
      return;
    }

    onTrainingStateChange({
      isTraining: true,
      progress: 10,
      stage: 'preprocessing'
    });

    try {
      onTrainingStateChange({ isTraining: true, progress: 30, stage: 'parameter_selection' });
      
      // Use automatic parameter selection for best results
      const { bestParams, bestModel } = await ARIMAModel.autoSelect(dataset.timeSeries, modelConfig);
      
      onTrainingStateChange({ isTraining: true, progress: 90, stage: 'validation' });

      onTrainingStateChange({
        isTraining: false,
        progress: 100,
        stage: 'completed'
      });

      console.log('✅ Model training completed successfully:', bestModel);
      console.log('✅ Best parameters found:', bestParams);
      onModelTrained(bestModel);
      message.success(`Model trained successfully! Best model: ARIMA(${bestParams.p},${bestParams.d},${bestParams.q})`);

    } catch (error) {
      console.error('❌ Model training failed:', error);
      onTrainingStateChange({
        isTraining: false,
        progress: 0,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Training failed'
      });
      message.error('Model training failed');
    }
  };

  const suggestedParams = getSuggestedParams();

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          <span>ARIMA Model Training</span>
        </Space>
      }
    >
      <Paragraph>
        Automatically configure and train your ARIMA forecasting model based on your data's statistical properties.
      </Paragraph>

      {/* Training Method */}
      <Alert
        message="Smart Model Selection"
        description="The system will test multiple forecasting approaches including Moving Average, Exponential Smoothing, Linear Trend, and ARIMA models, then select the best performer for your specific data pattern."
        type="info"
        icon={<ThunderboltOutlined />}
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* EDA Suggestions */}
      {edaResults && (
        <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f6ffed' }}>
          <Title level={5} style={{ color: '#52c41a', marginBottom: 16 }}>
            Suggested Parameters (from EDA)
          </Title>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="p (AR Order)"
                value={suggestedParams.p}
                valueStyle={{ color: '#52c41a' }}
                suffix="lags"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Autoregressive terms
              </Text>
            </Col>
            <Col span={8}>
              <Statistic
                title="d (Differencing)"
                value={suggestedParams.d}
                valueStyle={{ color: '#52c41a' }}
                suffix="order"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Stationarity transform
              </Text>
            </Col>
            <Col span={8}>
              <Statistic
                title="q (MA Order)"
                value={suggestedParams.q}
                valueStyle={{ color: '#52c41a' }}
                suffix="lags"
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Moving average terms
              </Text>
            </Col>
          </Row>
          <Paragraph style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
            <Text type="secondary">
              Based on stationarity test (ADF p-value: {edaResults.timeSeriesFeatures.stationarity.adfPValue.toFixed(3)}) 
              and autocorrelation analysis ({edaResults.autocorrelation.significantLags.length} significant lags)
            </Text>
          </Paragraph>
        </Card>
      )}

      {/* Advanced Configuration */}
      <Collapse ghost>
        <Panel 
          header={
            <Space>
              <SettingOutlined />
              <span>Advanced Configuration</span>
            </Space>
          } 
          key="advanced"
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={modelConfig}
            onValuesChange={(_, allValues) => setModelConfig({ ...modelConfig, ...allValues })}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Train/Test Split"
                  name="trainTestSplit"
                  tooltip="Proportion of data used for training"
                >
                  <InputNumber
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    style={{ width: '100%' }}
                    formatter={value => `${(Number(value) * 100).toFixed(0)}%`}
                    parser={value => Number(value!.replace('%', '')) / 100}
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Forecast Horizon"
                  name="forecastHorizon"
                  tooltip="Number of periods to forecast"
                >
                  <InputNumber
                    min={1}
                    max={365}
                    style={{ width: '100%' }}
                    suffix="periods"
                  />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Confidence Level"
                  name="confidenceLevel"
                  tooltip="Confidence level for prediction intervals"
                >
                  <Select style={{ width: '100%' }}>
                    <Select.Option value={0.90}>90%</Select.Option>
                    <Select.Option value={0.95}>95%</Select.Option>
                    <Select.Option value={0.99}>99%</Select.Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Max Iterations"
                  name="maxIterations"
                  tooltip="Maximum iterations for parameter estimation"
                >
                  <InputNumber
                    min={50}
                    max={500}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Panel>
      </Collapse>

      <Divider />

      {/* Training Progress */}
      {isTraining && (
        <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f0f9ff' }}>
          <Row align="middle" gutter={16}>
            <Col flex="auto">
              <Text strong>Training Progress</Text>
              <div style={{ marginTop: 8 }}>
                <Progress 
                  percent={onTrainingStateChange['progress']} 
                  strokeColor="#F65f42"
                  size="small"
                />
              </div>
            </Col>
            <Col>
              <LoadingOutlined style={{ fontSize: 24, color: '#F65f42' }} />
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Stage: {onTrainingStateChange['stage']?.replace('_', ' ') || 'Processing...'}
          </Text>
        </Card>
      )}

      {/* Train Button */}
      <Row>
        <Col span={24}>
          <Button
            type="primary"
            size="large"
            block
            onClick={trainModel}
            disabled={isTraining}
            icon={isTraining ? <LoadingOutlined /> : <PlayCircleOutlined />}
            style={{ height: 50 }}
          >
            {isTraining ? 'Training Models...' : 'Train Best Forecasting Model'}
          </Button>
        </Col>
      </Row>

      {/* Data Summary */}
      <Card size="small" style={{ marginTop: 24, backgroundColor: '#fafafa' }}>
        <Title level={5} style={{ marginBottom: 16 }}>Data Summary</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Data Points"
              value={dataset.timeSeries?.length || 0}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Frequency"
              value={dataset.summary?.frequency || 'Unknown'}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Training Size"
              value={Math.floor((dataset.timeSeries?.length || 0) * modelConfig.trainTestSplit)}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Test Size"
              value={Math.ceil((dataset.timeSeries?.length || 0) * (1 - modelConfig.trainTestSplit))}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
        </Row>
      </Card>
    </Card>
  );
};
