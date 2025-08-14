import React, { useState, useEffect, useCallback } from "react";
import {
  Layout,
  Tabs,
  Card,
  Typography,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  Table,
  Alert,
  Breadcrumb,
  Divider,
  message,
  Tag,
} from "antd";
import {
  RobotOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  BookOutlined,
  RightOutlined,
  DeleteOutlined,
  // BrainOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { DataUploader } from "./components/DataUploader";
import { ModelTrainer } from "./components/ModelTrainer";
import { ForecastChart } from "./components/ForecastChart";
import type {
  ProcessedDataset,
  FileUploadState,
  ModelTrainingState,
  TrainedLSTMModel,
  LSTMForecastResult,
} from "./types/lstm-forecasting";
import { LSTMModel } from "./lib/lstm-model";

const { Title, Text } = Typography;
const { Content } = Layout;

const LSTMForecastingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "upload" | "preprocessing" | "modeling" | "forecast" | "analysis"
  >("upload");

  const [dataset, setDataset] = useState<ProcessedDataset | null>(null);
  const [trainedModel, setTrainedModel] = useState<TrainedLSTMModel | null>(
    null
  );
  const [forecast, setForecast] = useState<LSTMForecastResult | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [uploadState, setUploadState] = useState<FileUploadState>({
    file: null,
    isUploading: false,
    progress: 0,
    error: null,
    preview: [],
  });

  const [trainingState, setTrainingState] = useState<ModelTrainingState>({
    isTraining: false,
    progress: 0,
    epoch: 0,
    totalEpochs: 100,
    stage: "preprocessing",
    error: null,
    currentLoss: null,
    validationLoss: null,
    metrics: {
      trainLoss: [],
      valLoss: [],
      epochs: [],
    },
  });

  // Persistence functions
  const saveToLocalStorage = useCallback((key: string, data: any) => {
    try {
      localStorage.setItem(`lstm_forecasting_${key}`, JSON.stringify(data));
      console.log(`💾 Saved ${key} to localStorage`);
    } catch (error) {
      console.warn("💾 Failed to save to localStorage:", error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((key: string) => {
    try {
      const data = localStorage.getItem(`lstm_forecasting_${key}`);
      if (data) {
        console.log(`💾 Loaded ${key} from localStorage`);
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.warn("💾 Failed to load from localStorage:", error);
      return null;
    }
  }, []);

  const clearAllData = useCallback(() => {
    localStorage.removeItem("lstm_forecasting_dataset");
    localStorage.removeItem("lstm_forecasting_trainedModel");
    localStorage.removeItem("lstm_forecasting_forecast");
    localStorage.removeItem("lstm_forecasting_activeTab");
    setDataset(null);
    setTrainedModel(null);
    setForecast(null);
    setActiveTab("upload");
    message.success("All LSTM data cleared successfully");
  }, []);

  // Load data on component mount
  useEffect(() => {
    console.log("🔄 Loading saved LSTM data...");

    const savedDataset = loadFromLocalStorage("dataset");
    const savedTrainedModel = loadFromLocalStorage("trainedModel");
    const savedForecast = loadFromLocalStorage("forecast");
    const savedActiveTab = loadFromLocalStorage("activeTab");

    if (savedDataset) {
      try {
        const restoredDataset = {
          ...savedDataset,
          timeSeries: savedDataset.timeSeries.map((point: any) => ({
            ...point,
            date: new Date(point.date),
          })),
          summary: {
            ...savedDataset.summary,
            startDate: new Date(savedDataset.summary.startDate),
            endDate: new Date(savedDataset.summary.endDate),
          },
        };
        setDataset(restoredDataset);
      } catch (error) {
        console.error("💾 Failed to restore dataset:", error);
      }
    }

    if (savedTrainedModel) {
      try {
        const restoredModel = {
          ...savedTrainedModel,
          trainedAt: new Date(savedTrainedModel.trainedAt),
        };
        setTrainedModel(restoredModel);
      } catch (error) {
        console.error("💾 Failed to restore trained model:", error);
      }
    }

    if (savedForecast) {
      try {
        const restoredForecast = {
          ...savedForecast,
          predictions: savedForecast.predictions.map((pred: any) => ({
            ...pred,
            date: new Date(pred.date),
          })),
          forecastOrigin: new Date(savedForecast.forecastOrigin),
        };
        setForecast(restoredForecast);
      } catch (error) {
        console.error("💾 Failed to restore forecast:", error);
      }
    }

    if (
      savedActiveTab &&
      ["upload", "preprocessing", "modeling", "forecast", "analysis"].includes(
        savedActiveTab
      )
    ) {
      setActiveTab(savedActiveTab);
    }

    setIsLoaded(true);
    console.log("💾 LSTM data loading complete");
  }, [loadFromLocalStorage]);

  // Save data when it changes (only after initial load)
  useEffect(() => {
    if (isLoaded && dataset) {
      saveToLocalStorage("dataset", dataset);
    }
  }, [dataset, saveToLocalStorage, isLoaded]);

  useEffect(() => {
    if (isLoaded && trainedModel) {
      saveToLocalStorage("trainedModel", trainedModel);
    }
  }, [trainedModel, saveToLocalStorage, isLoaded]);

  useEffect(() => {
    if (isLoaded && forecast) {
      saveToLocalStorage("forecast", forecast);
    }
  }, [forecast, saveToLocalStorage, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      saveToLocalStorage("activeTab", activeTab);
    }
  }, [activeTab, saveToLocalStorage, isLoaded]);

  // Auto-generate forecast when model is trained
  useEffect(() => {
    const generateForecast = async () => {
      if (trainedModel && dataset && !forecast) {
        try {
          message.info("Generating forecast from trained LSTM model...");

          // Create model instance for forecasting
          const model = LSTMModel.createModel(trainedModel.params, {
            params: trainedModel.params,
            forecastHorizon: 7, // Default 7 days
            confidenceLevel: 0.95,
            scaleData: true,
            includeSeasonality: true,
            includeExternalFeatures: true,
          });

          // Generate forecast
          const forecastResult = await model.forecast(dataset.timeSeries, 7);

          setForecast(forecastResult);
          setActiveTab("forecast");
          message.success("LSTM forecast generated successfully!");

          // Cleanup
          model.dispose();
        } catch (error) {
          console.error("Forecast generation failed:", error);
          message.error("Failed to generate forecast from LSTM model");
        }
      }
    };

    generateForecast();
  }, [trainedModel, dataset, forecast]);

  const handleDataUploaded = (newDataset: ProcessedDataset) => {
    setDataset(newDataset);
    setTrainedModel(null);
    setForecast(null);
    setActiveTab("preprocessing");
  };

  const handleModelTrained = (model: TrainedLSTMModel) => {
    setTrainedModel(model);
    setForecast(null);
  };

  const tabItems = [
    {
      key: "upload",
      label: (
        <Space>
          <UploadOutlined />
          Data Upload
        </Space>
      ),
      disabled: false,
      children: (
        <DataUploader
          onDataUploaded={handleDataUploaded}
          uploadState={uploadState}
          onUploadStateChange={(state) =>
            setUploadState((prev) => ({ ...prev, ...state }))
          }
        />
      ),
    },
    {
      key: "preprocessing",
      label: (
        <Space>
          {/* <BrainOutlined /> */}
          Data Analysis
        </Space>
      ),
      disabled: !dataset,
      children: (
        <Card
          title={
            <Space>
              {/* <BrainOutlined /> */}
              <span>LSTM Data Preprocessing</span>
            </Space>
          }
        >
          {dataset ? (
            <div>
              {/* Dataset Summary */}
              <Alert
                message="LSTM Dataset Ready"
                description={
                  <div>
                    <Text strong>Target Variable:</Text> {dataset?.valueField} (
                    {dataset?.aggregationType})<br />
                    <Text strong>Frequency:</Text> {dataset?.summary.frequency}{" "}
                    • <Text strong>Period:</Text>{" "}
                    {dataset?.summary.startDate.toLocaleDateString()} to{" "}
                    {dataset?.summary.endDate.toLocaleDateString()}
                    <br />
                    <Text strong>Neural Network Suitability:</Text>{" "}
                    {dataset.timeSeries.length > 200
                      ? "✅ Excellent"
                      : dataset.timeSeries.length > 100
                      ? "⚠️ Good"
                      : "❌ Limited (need 100+ points)"}
                  </div>
                }
                type="info"
                style={{ marginBottom: 24 }}
              />

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Statistic
                    title="Data Points"
                    value={dataset?.timeSeries.length}
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Mean Value"
                    value={dataset?.summary.meanValue.toFixed(0)}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Std Deviation"
                    value={dataset?.summary.std.toFixed(0)}
                    valueStyle={{ color: "#722ed1" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Frequency"
                    value={dataset?.summary.frequency}
                    valueStyle={{ color: "#fa8c16" }}
                  />
                </Col>
              </Row>

              {/* LSTM Readiness Assessment */}
              <Card
                size="small"
                title="LSTM Readiness Assessment"
                style={{ marginBottom: 24 }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Row align="middle">
                    <Col span={1}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor:
                            dataset.timeSeries.length >= 100
                              ? "#52c41a"
                              : "#ff4d4f",
                        }}
                      />
                    </Col>
                    <Col span={23}>
                      <Text>
                        <Text strong>Data Size:</Text>{" "}
                        {dataset.timeSeries.length >= 200
                          ? "Excellent"
                          : dataset.timeSeries.length >= 100
                          ? "Sufficient"
                          : "Insufficient"}{" "}
                        ({dataset.timeSeries.length} points)
                      </Text>
                    </Col>
                  </Row>
                  <Row align="middle">
                    <Col span={1}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor:
                            dataset.summary.std > 0 ? "#52c41a" : "#ff4d4f",
                        }}
                      />
                    </Col>
                    <Col span={23}>
                      <Text>
                        <Text strong>Data Variance:</Text>{" "}
                        {dataset.summary.std > dataset.summary.meanValue * 0.1
                          ? "Good variability"
                          : "Low variability"}{" "}
                        (CV:{" "}
                        {(
                          (dataset.summary.std / dataset.summary.meanValue) *
                          100
                        ).toFixed(1)}
                        %)
                      </Text>
                    </Col>
                  </Row>
                  <Row align="middle">
                    <Col span={1}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: "#1890ff",
                        }}
                      />
                    </Col>
                    <Col span={23}>
                      <Text>
                        <Text strong>Time Series Length:</Text> Supports{" "}
                        {Math.floor(dataset.timeSeries.length * 0.8)} training
                        samples with up to{" "}
                        {Math.min(
                          30,
                          Math.floor(dataset.timeSeries.length / 4)
                        )}{" "}
                        day lookback
                      </Text>
                    </Col>
                  </Row>
                </Space>
              </Card>

              {/* Statistics Grid */}
              <Card size="small" title="Statistical Properties">
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Statistic
                      title="Min Value"
                      value={dataset.summary.minValue.toFixed(2)}
                      precision={2}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Max Value"
                      value={dataset.summary.maxValue.toFixed(2)}
                      precision={2}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Total Records"
                      value={dataset.summary.totalRecords}
                    />
                  </Col>
                </Row>
              </Card>

              {/* LSTM Advantages */}
              <Alert
                message="Why LSTM for Pizza Sales Forecasting?"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li>
                      <Text strong>Long-term Dependencies:</Text> Captures
                      patterns spanning weeks or months
                    </li>
                    <li>
                      <Text strong>Non-linear Patterns:</Text> Learns complex
                      relationships in sales data
                    </li>
                    <li>
                      <Text strong>Seasonal Intelligence:</Text> Automatically
                      detects weekly, monthly cycles
                    </li>
                    <li>
                      <Text strong>Feature Engineering:</Text> Uses lag values,
                      moving averages, and calendar features
                    </li>
                    <li>
                      <Text strong>High Accuracy:</Text> Typically achieves
                      85-95% directional accuracy
                    </li>
                  </ul>
                }
                type="success"
                style={{ marginTop: 24 }}
              />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 48 }}>
              {/* <BrainOutlined
                style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
              /> */}
              <Text type="secondary">
                Data preprocessing will appear here after upload
              </Text>
            </div>
          )}
        </Card>
      ),
    },
    {
      key: "modeling",
      label: (
        <Space>
          <ThunderboltOutlined />
          Neural Network Training
        </Space>
      ),
      disabled: !dataset,
      children: (
        <div>
          <ModelTrainer
            dataset={dataset!}
            onModelTrained={handleModelTrained}
            trainingState={trainingState}
            onTrainingStateChange={(state) =>
              setTrainingState((prev) => ({ ...prev, ...state }))
            }
          />

          {trainedModel && (
            <Card title="Trained LSTM Model" style={{ marginTop: 24 }}>
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="Model Architecture"
                    value={trainedModel.name}
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="R² Score"
                    value={trainedModel.validationMetrics.r2.toFixed(3)}
                    valueStyle={{
                      color:
                        trainedModel.validationMetrics.r2 > 0.7
                          ? "#52c41a"
                          : trainedModel.validationMetrics.r2 > 0.5
                          ? "#fa8c16"
                          : "#ff4d4f",
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="MAPE"
                    value={`${trainedModel.validationMetrics.mape.toFixed(1)}%`}
                    valueStyle={{
                      color:
                        trainedModel.validationMetrics.mape < 15
                          ? "#52c41a"
                          : trainedModel.validationMetrics.mape < 25
                          ? "#fa8c16"
                          : "#ff4d4f",
                    }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Directional Accuracy"
                    value={`${trainedModel.validationMetrics.directionalAccuracy.toFixed(
                      1
                    )}%`}
                    valueStyle={{
                      color:
                        trainedModel.validationMetrics.directionalAccuracy > 70
                          ? "#52c41a"
                          : trainedModel.validationMetrics.directionalAccuracy >
                            60
                          ? "#fa8c16"
                          : "#ff4d4f",
                    }}
                  />
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Statistic
                    title="Training Time"
                    value={`${(trainedModel.trainingTime / 1000).toFixed(1)}s`}
                    valueStyle={{ color: "#722ed1" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Parameters"
                    value={trainedModel.modelArchitecture.totalParams.toLocaleString()}
                    valueStyle={{ color: "#13c2c2" }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Best Epoch"
                    value={trainedModel.trainingHistory.bestEpoch + 1}
                    valueStyle={{ color: "#eb2f96" }}
                  />
                </Col>
                <Col span={6}>
                  <Tag
                    color={
                      trainedModel.convergenceStatus === "completed"
                        ? "green"
                        : trainedModel.convergenceStatus === "early_stopped"
                        ? "orange"
                        : "red"
                    }
                  >
                    {trainedModel.convergenceStatus.toUpperCase()}
                  </Tag>
                </Col>
              </Row>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: "forecast",
      label: (
        <Space>
          <LineChartOutlined />
          Forecasting Results
        </Space>
      ),
      disabled: !trainedModel,
      children: (
        <div>
          {forecast ? (
            <div>
              <Card title="LSTM Forecast Results" style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Statistic
                      title="Forecast Horizon"
                      value={forecast.horizon}
                      suffix="days"
                      valueStyle={{ color: "#1890ff" }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Model Confidence"
                      value={`${(forecast.modelConfidence * 100).toFixed(1)}%`}
                      valueStyle={{
                        color:
                          forecast.modelConfidence > 0.8
                            ? "#52c41a"
                            : forecast.modelConfidence > 0.6
                            ? "#fa8c16"
                            : "#ff4d4f",
                      }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Avg Daily Forecast"
                      value={Math.round(
                        forecast.predictions.reduce(
                          (sum, p) => sum + p.value,
                          0
                        ) / forecast.predictions.length
                      )}
                      valueStyle={{ color: "#722ed1" }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Total Forecast"
                      value={Math.round(
                        forecast.predictions.reduce(
                          (sum, p) => sum + p.value,
                          0
                        )
                      )}
                      valueStyle={{ color: "#fa8c16" }}
                    />
                  </Col>
                </Row>

                <ForecastChart
                  timeSeries={dataset?.timeSeries || []}
                  forecast={forecast}
                  showConfidenceInterval={true}
                  primaryField={dataset?.valueField || "Value"}
                />
              </Card>

              {/* Detailed Forecast Table */}
              <Card title="Forecast Details" size="small">
                <Table
                  columns={[
                    {
                      title: "Date",
                      dataIndex: "date",
                      key: "date",
                      render: (date: Date) => date.toLocaleDateString(),
                    },
                    {
                      title: "Forecasted Value",
                      dataIndex: "value",
                      key: "value",
                      render: (value: number) => {
                        if (dataset?.valueField === "quantity") {
                          return Math.round(value).toLocaleString();
                        } else if (
                          dataset?.valueField === "total_price" ||
                          dataset?.valueField === "unit_price"
                        ) {
                          return `$${value.toFixed(2)}`;
                        }
                        return value.toFixed(2);
                      },
                    },
                    {
                      title: "Lower CI (95%)",
                      key: "lowerCI",
                      render: (_, record, index) => {
                        const lowerCI =
                          forecast.confidenceIntervals.lower[index];
                        if (dataset?.valueField === "quantity") {
                          return Math.round(lowerCI).toLocaleString();
                        } else if (
                          dataset?.valueField === "total_price" ||
                          dataset?.valueField === "unit_price"
                        ) {
                          return `$${lowerCI.toFixed(2)}`;
                        }
                        return lowerCI.toFixed(2);
                      },
                    },
                    {
                      title: "Upper CI (95%)",
                      key: "upperCI",
                      render: (_, record, index) => {
                        const upperCI =
                          forecast.confidenceIntervals.upper[index];
                        if (dataset?.valueField === "quantity") {
                          return Math.round(upperCI).toLocaleString();
                        } else if (
                          dataset?.valueField === "total_price" ||
                          dataset?.valueField === "unit_price"
                        ) {
                          return `$${upperCI.toFixed(2)}`;
                        }
                        return upperCI.toFixed(2);
                      },
                    },
                  ]}
                  dataSource={forecast.predictions}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  scroll={{ y: 400 }}
                  rowKey={(record, index) => index?.toString() || "0"}
                />
              </Card>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 48 }}>
              <LineChartOutlined
                style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
              />
              <Text type="secondary">
                LSTM forecast results will appear here after model training
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "analysis",
      label: (
        <Space>
          <BookOutlined />
          Technical Analysis
        </Space>
      ),
      disabled: !trainedModel,
      children: (
        <Card
          title={
            <Space>
              <RobotOutlined />
              Technical Analysis: LSTM Neural Network Architecture
            </Space>
          }
        >
          {trainedModel && dataset && forecast ? (
            <div>
              {/* Model Architecture Overview */}
              <Alert
                message={`LSTM Model: ${trainedModel.name}`}
                description={
                  <div>
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={8} style={{ textAlign: "center" }}>
                        <Title
                          level={2}
                          style={{ color: "#1890ff", margin: 0 }}
                        >
                          {trainedModel.params.lookBackDays}
                        </Title>
                        <Text type="secondary">Days Lookback</Text>
                        <br />
                        <Text style={{ fontSize: 12 }}>
                          Sequence length for predictions
                        </Text>
                      </Col>
                      <Col span={8} style={{ textAlign: "center" }}>
                        <Title
                          level={2}
                          style={{ color: "#52c41a", margin: 0 }}
                        >
                          {trainedModel.params.hiddenUnits}
                        </Title>
                        <Text type="secondary">LSTM Units</Text>
                        <br />
                        <Text style={{ fontSize: 12 }}>
                          Neural network capacity
                        </Text>
                      </Col>
                      <Col span={8} style={{ textAlign: "center" }}>
                        <Title
                          level={2}
                          style={{ color: "#722ed1", margin: 0 }}
                        >
                          {trainedModel.params.layers}
                        </Title>
                        <Text type="secondary">LSTM Layers</Text>
                        <br />
                        <Text style={{ fontSize: 12 }}>Network depth</Text>
                      </Col>
                    </Row>
                  </div>
                }
                type="info"
                style={{ marginBottom: 24 }}
              />

              {/* Technical Specifications */}
              <Card
                size="small"
                title="Model Architecture Details"
                style={{ marginBottom: 24 }}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Input Shape"
                      value={`[${trainedModel.modelArchitecture.inputShape.join(
                        ", "
                      )}]`}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Total Parameters"
                      value={trainedModel.modelArchitecture.totalParams.toLocaleString()}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Trainable Parameters"
                      value={trainedModel.modelArchitecture.trainableParams.toLocaleString()}
                    />
                  </Col>
                </Row>
                <Divider />
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Learning Rate"
                      value={trainedModel.params.learningRate}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Dropout Rate"
                      value={`${(trainedModel.params.dropout * 100).toFixed(
                        0
                      )}%`}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Batch Size"
                      value={trainedModel.params.batchSize}
                    />
                  </Col>
                </Row>
              </Card>

              {/* Performance Analysis */}
              <Card
                size="small"
                title="Performance Metrics Analysis"
                style={{ marginBottom: 24 }}
              >
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="R² Score"
                      value={trainedModel.validationMetrics.r2.toFixed(4)}
                      valueStyle={{
                        color:
                          trainedModel.validationMetrics.r2 > 0.8
                            ? "#52c41a"
                            : trainedModel.validationMetrics.r2 > 0.6
                            ? "#fa8c16"
                            : "#ff4d4f",
                      }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="RMSE"
                      value={trainedModel.validationMetrics.rmse.toFixed(2)}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="MAE"
                      value={trainedModel.validationMetrics.mae.toFixed(2)}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Directional Accuracy"
                      value={`${trainedModel.validationMetrics.directionalAccuracy.toFixed(
                        1
                      )}%`}
                    />
                  </Col>
                </Row>
              </Card>

              {/* Key Technical Insights */}
              <Alert
                message="LSTM Technical Insights"
                description={
                  <ul style={{ margin: 8, paddingLeft: 16 }}>
                    <li>
                      <Text strong>Memory Capacity:</Text>{" "}
                      {trainedModel.params.lookBackDays} days of historical
                      context with {trainedModel.params.hiddenUnits} memory
                      cells
                    </li>
                    <li>
                      <Text strong>Feature Engineering:</Text> Automatic lag
                      features, moving averages, seasonal indicators, and trend
                      components
                    </li>
                    <li>
                      <Text strong>Regularization:</Text>{" "}
                      {(trainedModel.params.dropout * 100).toFixed(0)}% dropout
                      prevents overfitting, L2 regularization on weights
                    </li>
                    <li>
                      <Text strong>Training Efficiency:</Text>{" "}
                      {trainedModel.convergenceStatus === "early_stopped"
                        ? "Early stopping prevented overfitting"
                        : "Completed full training cycle"}
                    </li>
                    <li>
                      <Text strong>Prediction Quality:</Text>{" "}
                      {trainedModel.validationMetrics.directionalAccuracy > 70
                        ? "Excellent"
                        : trainedModel.validationMetrics.directionalAccuracy >
                          60
                        ? "Good"
                        : "Fair"}{" "}
                      trend prediction capability
                    </li>
                  </ul>
                }
                type="success"
              />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 48 }}>
              <BookOutlined
                style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }}
              />
              <Text type="secondary">
                Technical analysis will appear here after model training
              </Text>
            </div>
          )}
        </Card>
      ),
    },
  ];

  return (
    <Content style={{ margin: 24 }}>
      {/* Clear Data Button */}
      {(dataset || trainedModel || forecast) && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button danger icon={<DeleteOutlined />} onClick={clearAllData}>
            Clear All LSTM Data
          </Button>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <Breadcrumb
          separator={<RightOutlined />}
          items={[
            { title: <Link to="/">Dashboard</Link> },
            { title: "LSTM Forecasting" },
          ]}
        />
      </div>

      {/* Main Content */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        items={tabItems}
        size="large"
      />

      {/* Error Display */}
      {(uploadState.error || trainingState.error) && (
        <Alert
          message="Error"
          description={uploadState.error || trainingState.error}
          type="error"
          showIcon
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            maxWidth: 400,
            zIndex: 1000,
          }}
          closable
        />
      )}
    </Content>
  );
};

export default LSTMForecastingDashboard;
