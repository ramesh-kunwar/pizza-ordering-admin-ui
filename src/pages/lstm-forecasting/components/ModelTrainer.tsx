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
  Switch,
  Divider,
  message,
  Table,
  Tag 
} from 'antd';
import { 
  PlayCircleOutlined, 
  ThunderboltOutlined, 
  SettingOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  StopOutlined,
  LineChartOutlined 
} from '@ant-design/icons';
import { LSTMModel } from '../lib/lstm-model';
import type { 
  ProcessedDataset, 
  LSTMParams, 
  LSTMModelConfig, 
  TrainedLSTMModel, 
  ModelTrainingState 
} from '../types/lstm-forecasting';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ModelTrainerProps {
  dataset: ProcessedDataset;
  onModelTrained: (model: TrainedLSTMModel) => void;
  trainingState: ModelTrainingState;
  onTrainingStateChange: (state: Partial<ModelTrainingState>) => void;
}

export const ModelTrainer: React.FC<ModelTrainerProps> = ({
  dataset,
  onModelTrained,
  trainingState,
  onTrainingStateChange
}) => {
  const [form] = Form.useForm();
  const [modelConfig, setModelConfig] = useState<LSTMModelConfig>({
    params: {
      lookBackDays: 14,
      epochs: 100,
      batchSize: 32,
      learningRate: 0.001,
      hiddenUnits: 64,
      dropout: 0.2,
      layers: 2,
      validationSplit: 0.2,
    },
    forecastHorizon: 7,
    confidenceLevel: 0.95,
    scaleData: true,
    includeSeasonality: true,
    includeExternalFeatures: true,
  });

  const [useAutoSelection, setUseAutoSelection] = useState(true);
  const [trainingResults, setTrainingResults] = useState<TrainedLSTMModel[]>([]);

  const trainModel = useCallback(async () => {
    if (!dataset.timeSeries || dataset.timeSeries.length < 50) {
      message.error('Insufficient data for LSTM training (minimum 50 data points required)');
      return;
    }

    onTrainingStateChange({
      isTraining: true,
      progress: 0,
      epoch: 0,
      totalEpochs: modelConfig.params.epochs,
      stage: 'preprocessing',
      error: null,
      currentLoss: null,
      validationLoss: null,
      metrics: { trainLoss: [], valLoss: [], epochs: [] }
    });

    try {
      let trainedModel: TrainedLSTMModel;

      if (useAutoSelection) {
        // Auto model selection
        onTrainingStateChange({ stage: 'training', progress: 10 });
        
        const { bestModel } = await LSTMModel.autoSelect(
          dataset.timeSeries,
          modelConfig,
          (progress) => {
            onTrainingStateChange({
              progress: Math.min(90, 10 + progress.progress * 0.8),
              stage: 'training',
              currentLoss: null,
              validationLoss: null,
            });
          }
        );
        
        trainedModel = bestModel;
        
      } else {
        // Manual configuration
        const model = LSTMModel.createModel(modelConfig.params, modelConfig);
        
        trainedModel = await model.train(
          dataset.timeSeries,
          (epoch, logs) => {
            const progress = ((epoch + 1) / modelConfig.params.epochs) * 90;
            
            onTrainingStateChange({
              progress,
              epoch: epoch + 1,
              currentLoss: logs?.loss || null,
              validationLoss: logs?.val_loss || null,
              metrics: {
                trainLoss: [...trainingState.metrics.trainLoss, logs?.loss || 0],
                valLoss: [...trainingState.metrics.valLoss, logs?.val_loss || 0],
                epochs: [...trainingState.metrics.epochs, epoch + 1],
              }
            });
          }
        );
        
        model.dispose();
      }

      onTrainingStateChange({
        isTraining: false,
        progress: 100,
        stage: 'completed',
      });

      setTrainingResults(prev => [trainedModel, ...prev]);
      onModelTrained(trainedModel);
      
      message.success(`LSTM model trained successfully! R²: ${trainedModel.validationMetrics.r2.toFixed(3)}`);

    } catch (error) {
      console.error('LSTM training failed:', error);
      onTrainingStateChange({
        isTraining: false,
        progress: 0,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Training failed'
      });
      message.error('LSTM model training failed');
    }
  }, [dataset, modelConfig, useAutoSelection, onModelTrained, onTrainingStateChange, trainingState.metrics]);

  const stopTraining = useCallback(() => {
    onTrainingStateChange({
      isTraining: false,
      stage: 'error',
      error: 'Training stopped by user'
    });
    message.info('Training stopped');
  }, [onTrainingStateChange]);

  const formatTrainingTime = (ms: number) => {
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getConfigurationSuggestions = () => {
    const dataLength = dataset.timeSeries?.length || 0;
    
    if (dataLength < 100) {
      return {
        lookBackDays: 7,
        epochs: 50,
        hiddenUnits: 32,
        layers: 1,
        reasoning: "Small dataset - using simple configuration"
      };
    } else if (dataLength < 500) {
      return {
        lookBackDays: 14,
        epochs: 75,
        hiddenUnits: 64,
        layers: 2,
        reasoning: "Medium dataset - balanced complexity"
      };
    } else {
      return {
        lookBackDays: 21,
        epochs: 100,
        hiddenUnits: 128,
        layers: 2,
        reasoning: "Large dataset - can handle complex models"
      };
    }
  };

  const suggestions = getConfigurationSuggestions();

  const resultColumns = [
    {
      title: 'Model',
      dataIndex: 'name',
      key: 'name',
      width: 250,
    },
    {
      title: 'R²',
      dataIndex: ['validationMetrics', 'r2'],
      key: 'r2',
      width: 80,
      render: (value: number) => (
        <Tag color={value > 0.7 ? 'green' : value > 0.5 ? 'orange' : 'red'}>
          {value.toFixed(3)}
        </Tag>
      ),
    },
    {
      title: 'MAPE',
      dataIndex: ['validationMetrics', 'mape'],
      key: 'mape',
      width: 80,
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: 'RMSE',
      dataIndex: ['validationMetrics', 'rmse'],
      key: 'rmse',
      width: 80,
      render: (value: number) => value.toFixed(1),
    },
    {
      title: 'Training Time',
      dataIndex: 'trainingTime',
      key: 'trainingTime',
      width: 100,
      render: (value: number) => formatTrainingTime(value),
    },
    {
      title: 'Status',
      dataIndex: 'convergenceStatus',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const colors = {
          'completed': 'green',
          'converged': 'green',
          'early_stopped': 'orange',
          'failed': 'red',
        };
        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      },
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Training Configuration */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>LSTM Neural Network Training</span>
          </Space>
        }
      >
        <Paragraph>
          Train a Long Short-Term Memory (LSTM) neural network for high-accuracy pizza sales forecasting.
          LSTMs excel at learning complex temporal patterns and seasonal trends.
        </Paragraph>

        {/* Auto vs Manual Selection */}
        <Alert
          message="Training Mode"
          description={
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Switch 
                  checked={useAutoSelection}
                  onChange={setUseAutoSelection}
                />
                <Text strong>
                  {useAutoSelection ? 'Automatic Model Selection' : 'Manual Configuration'}
                </Text>
              </Space>
              <Text type="secondary">
                {useAutoSelection 
                  ? 'Tests 5 different LSTM configurations and selects the best performer'
                  : 'Use custom parameters for advanced users'
                }
              </Text>
            </Space>
          }
          type="info"
          style={{ marginBottom: 24 }}
        />

        {/* Data Summary */}
        <Card size="small" style={{ marginBottom: 24, backgroundColor: '#fafafa' }}>
          <Title level={5} style={{ marginBottom: 16 }}>Dataset Summary</Title>
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
                title="Mean Value"
                value={dataset.summary?.meanValue.toFixed(0) || 0}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Std Deviation"
                value={dataset.summary?.std.toFixed(0) || 0}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          </Row>
        </Card>

        {/* Configuration Suggestions */}
        {!useAutoSelection && (
          <Alert
            message="Configuration Suggestions"
            description={
              <div>
                <Text>Based on your dataset size ({dataset.timeSeries?.length} points): {suggestions.reasoning}</Text>
                <ul style={{ margin: '8px 0', paddingLeft: 16 }}>
                  <li>Look-back days: {suggestions.lookBackDays}</li>
                  <li>Training epochs: {suggestions.epochs}</li>
                  <li>Hidden units: {suggestions.hiddenUnits}</li>
                  <li>LSTM layers: {suggestions.layers}</li>
                </ul>
              </div>
            }
            type="info"
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Manual Configuration Panel */}
        {!useAutoSelection && (
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
                onValuesChange={(_, allValues) => {
                  setModelConfig(prev => ({
                    ...prev,
                    ...allValues,
                    params: { ...prev.params, ...allValues.params }
                  }));
                }}
              >
                <Title level={5}>Neural Network Architecture</Title>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Look-back Days"
                      name={['params', 'lookBackDays']}
                      tooltip="Number of previous days the model looks at to make predictions"
                    >
                      <InputNumber
                        min={7}
                        max={60}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Hidden Units"
                      name={['params', 'hiddenUnits']}
                      tooltip="Number of LSTM units in each layer (more = more complex)"
                    >
                      <InputNumber
                        min={16}
                        max={256}
                        step={16}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="LSTM Layers"
                      name={['params', 'layers']}
                      tooltip="Number of LSTM layers (more = deeper network)"
                    >
                      <InputNumber
                        min={1}
                        max={3}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Title level={5}>Training Parameters</Title>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Epochs"
                      name={['params', 'epochs']}
                      tooltip="Number of training iterations"
                    >
                      <InputNumber
                        min={20}
                        max={200}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Batch Size"
                      name={['params', 'batchSize']}
                      tooltip="Number of samples processed together"
                    >
                      <Select style={{ width: '100%' }}>
                        <Select.Option value={16}>16</Select.Option>
                        <Select.Option value={32}>32</Select.Option>
                        <Select.Option value={64}>64</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Learning Rate"
                      name={['params', 'learningRate']}
                      tooltip="How fast the model learns (lower = more stable)"
                    >
                      <Select style={{ width: '100%' }}>
                        <Select.Option value={0.0001}>0.0001 (Very Slow)</Select.Option>
                        <Select.Option value={0.0005}>0.0005 (Slow)</Select.Option>
                        <Select.Option value={0.001}>0.001 (Normal)</Select.Option>
                        <Select.Option value={0.01}>0.01 (Fast)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Dropout Rate"
                      name={['params', 'dropout']}
                      tooltip="Prevents overfitting (0.2 = 20% dropout)"
                    >
                      <InputNumber
                        min={0}
                        max={0.5}
                        step={0.1}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Forecast Horizon"
                      name="forecastHorizon"
                      tooltip="Number of days to predict"
                    >
                      <InputNumber
                        min={1}
                        max={90}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Validation Split"
                      name={['params', 'validationSplit']}
                      tooltip="Percentage of data used for validation"
                    >
                      <InputNumber
                        min={0.1}
                        max={0.3}
                        step={0.05}
                        style={{ width: '100%' }}
                        formatter={value => `${(Number(value) * 100).toFixed(0)}%`}
                        parser={value => Number(value!.replace('%', '')) / 100}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Title level={5}>Feature Engineering</Title>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Scale Data"
                      name="scaleData"
                      valuePropName="checked"
                      tooltip="Normalize data for better training"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Include Seasonality"
                      name="includeSeasonality"
                      valuePropName="checked"
                      tooltip="Add seasonal features (weekday, month)"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="External Features"
                      name="includeExternalFeatures"
                      valuePropName="checked"
                      tooltip="Include holiday and trend features"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Panel>
          </Collapse>
        )}

        <Divider />

        {/* Training Controls */}
        <Row>
          <Col span={24}>
            <Space>
              <Button
                type="primary"
                size="large"
                icon={trainingState.isTraining ? <LoadingOutlined /> : <PlayCircleOutlined />}
                onClick={trainModel}
                disabled={trainingState.isTraining}
                style={{ height: 50, minWidth: 200 }}
              >
                {useAutoSelection 
                  ? (trainingState.isTraining ? 'Training Models...' : 'Train Best LSTM Model')
                  : (trainingState.isTraining ? 'Training...' : 'Train LSTM Model')
                }
              </Button>
              
              {trainingState.isTraining && (
                <Button
                  danger
                  size="large"
                  icon={<StopOutlined />}
                  onClick={stopTraining}
                  style={{ height: 50 }}
                >
                  Stop Training
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Training Progress */}
      {trainingState.isTraining && (
        <Card title="Training Progress" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Overall Progress</Text>
                <Progress 
                  percent={trainingState.progress} 
                  status="active"
                  strokeColor="#1890ff"
                />
              </Col>
              <Col span={12}>
                <Text strong>Stage: {trainingState.stage}</Text>
                {trainingState.epoch > 0 && (
                  <div>
                    <Text type="secondary">
                      Epoch {trainingState.epoch}/{trainingState.totalEpochs}
                    </Text>
                  </div>
                )}
              </Col>
            </Row>

            {(trainingState.currentLoss !== null || trainingState.validationLoss !== null) && (
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Training Loss"
                    value={trainingState.currentLoss?.toFixed(6) || 'N/A'}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Validation Loss"
                    value={trainingState.validationLoss?.toFixed(6) || 'N/A'}
                    valueStyle={{ fontSize: 14 }}
                  />
                </Col>
              </Row>
            )}
          </Space>
        </Card>
      )}

      {/* Training Results */}
      {trainingResults.length > 0 && (
        <Card 
          title={
            <Space>
              <LineChartOutlined />
              <span>Training Results</span>
            </Space>
          }
          size="small"
        >
          <Table
            columns={resultColumns}
            dataSource={trainingResults}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 800 }}
          />
        </Card>
      )}

      {/* Error Display */}
      {trainingState.error && (
        <Alert
          message="Training Error"
          description={trainingState.error}
          type="error"
          showIcon
          closable
          onClose={() => onTrainingStateChange({ error: null })}
        />
      )}
    </Space>
  );
};
