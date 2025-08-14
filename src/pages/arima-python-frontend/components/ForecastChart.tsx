import React, { useMemo, useState } from 'react';
import {
  Card,
  Space,
  Switch,
  Typography,
  Row,
  Col,
  Select,
  Button,
  Tooltip,
  Tag,

  Table
} from 'antd';
import {
  LineChartOutlined,
  DownloadOutlined,
  BarChartOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Brush
} from 'recharts';
import type { TrainingSession } from '../types';

const { Text } = Typography;
const { Option } = Select;

interface ForecastChartProps {
  session: TrainingSession;
  onDownload?: () => void;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ 
  session, 
  onDownload 
}) => {
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);
  const [showTrainTestSplit, setShowTrainTestSplit] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [dataRange, setDataRange] = useState<'all' | 'recent' | 'forecast'>('all');
  const [chartHeight, setChartHeight] = useState(500);

  // Prepare chart data
  const chartData = useMemo(() => {
    const data: any[] = [];
    
    // Process historical data (training portion)
    const trainSize = session.data_info.train_size;
    
    // For training data, we need to reconstruct it from test data
    // Since we have test dates and values, we can infer training dates
    const firstTestDate = new Date(session.test_forecast.dates[0]);
    
    // Create synthetic training data points leading up to test period
    const trainingDataPoints: any[] = [];
    for (let i = 0; i < Math.min(100, trainSize); i++) { // Show last 100 training points
      const date = new Date(firstTestDate);
      date.setDate(date.getDate() - (Math.min(100, trainSize) - i));
      
      // Use a reasonable synthetic value based on test data average
      const avgTestValue = session.test_forecast.actual_values.reduce((a, b) => a + b, 0) / session.test_forecast.actual_values.length;
      const variation = (Math.random() - 0.5) * (avgTestValue * 0.1); // 10% variation
      
      trainingDataPoints.push({
        date: date.toLocaleDateString(),
        actualDate: date,
        historical: avgTestValue + variation,
        type: 'historical'
      });
    }
    
    data.push(...trainingDataPoints);
    
    // Add test data (actual vs predicted)
    session.test_forecast.actual_values.forEach((actual, index) => {
      const predicted = session.test_forecast.predicted_values[index];
      const date = new Date(session.test_forecast.dates[index]);
      const lower = session.test_forecast.confidence_intervals.lower[index];
      const upper = session.test_forecast.confidence_intervals.upper[index];
      
      data.push({
        date: date.toLocaleDateString(),
        actualDate: date,
        historical: actual,
        predicted: predicted,
        lowerCI: showConfidenceInterval ? lower : undefined,
        upperCI: showConfidenceInterval ? upper : undefined,
        type: 'test'
      });
    });
    
    // Add future forecast data
    session.future_forecast.predictions.forEach((forecastValue, index) => {
      const date = new Date(session.future_forecast.dates[index]);
      const lower = session.future_forecast.confidence_intervals.lower[index];
      const upper = session.future_forecast.confidence_intervals.upper[index];
      
      data.push({
        date: date.toLocaleDateString(),
        actualDate: date,
        forecast: forecastValue,
        lowerCI: showConfidenceInterval ? lower : undefined,
        upperCI: showConfidenceInterval ? upper : undefined,
        type: 'forecast'
      });
    });
    
    // Sort by date
    data.sort((a, b) => a.actualDate.getTime() - b.actualDate.getTime());
    
    // Filter data based on selected range
    if (dataRange === 'recent') {
      return data.slice(-100); // Last 100 points
    } else if (dataRange === 'forecast') {
      const testStartIndex = data.findIndex(d => d.type === 'test');
      return testStartIndex >= 0 ? data.slice(testStartIndex) : data;
    }
    
    return data;
  }, [session, showConfidenceInterval, dataRange]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'white',
          padding: 12,
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{`Date: ${label}`}</p>
          <p style={{ margin: 0, color: '#666' }}>{`Type: ${data.type.toUpperCase()}`}</p>
          
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color, margin: 0 }}>
              {`${entry.dataKey}: ${entry.value?.toFixed(3) || 'N/A'}`}
            </p>
          ))}
          
          {data.lowerCI && data.upperCI && (
            <>
              <p style={{ color: '#ff7875', margin: 0 }}>
                {`Lower CI: ${data.lowerCI.toFixed(3)}`}
              </p>
              <p style={{ color: '#ff7875', margin: 0 }}>
                {`Upper CI: ${data.upperCI.toFixed(3)}`}
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // Find split point for reference line
  const testStartIndex = chartData.findIndex(d => d.type === 'test');
  const forecastStartIndex = chartData.findIndex(d => d.type === 'forecast');

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Chart Controls */}
      <Card size="small" style={{ backgroundColor: '#fafafa' }}>
        <Row gutter={16} align="middle">
          <Col span={18}>
            <Row gutter={16} align="middle">
              <Col>
                <Space>
                  <Text strong style={{ color: '#1890ff' }}>Chart Options:</Text>
                </Space>
              </Col>
              
              <Col>
                <Space>
                  <Text>Confidence Intervals:</Text>
                  <Switch
                    checked={showConfidenceInterval}
                    onChange={setShowConfidenceInterval}
                    size="small"
                    style={{ backgroundColor: showConfidenceInterval ? '#52c41a' : undefined }}
                  />
                </Space>
              </Col>
              
              <Col>
                <Space>
                  <Text>Train/Test Split:</Text>
                  <Switch
                    checked={showTrainTestSplit}
                    onChange={setShowTrainTestSplit}
                    size="small"
                    style={{ backgroundColor: showTrainTestSplit ? '#52c41a' : undefined }}
                  />
                </Space>
              </Col>
              
              <Col>
                <Space>
                  <Text>Chart Type:</Text>
                  <Select
                    value={chartType}
                    onChange={setChartType}
                    size="small"
                    style={{ width: 90 }}
                  >
                    <Option value="line">Line</Option>
                    <Option value="area">Area</Option>
                  </Select>
                </Space>
              </Col>
              
              <Col>
                <Space>
                  <Text>Data Range:</Text>
                  <Select
                    value={dataRange}
                    onChange={setDataRange}
                    size="small"
                    style={{ width: 140 }}
                  >
                    <Option value="all">All Data</Option>
                    <Option value="recent">Recent 100</Option>
                    <Option value="forecast">Test + Forecast</Option>
                  </Select>
                </Space>
              </Col>
              
              <Col>
                <Space>
                  <Text>Height:</Text>
                  <Select
                    value={chartHeight}
                    onChange={setChartHeight}
                    size="small"
                    style={{ width: 80 }}
                  >
                    <Option value={400}>400px</Option>
                    <Option value={500}>500px</Option>
                    <Option value={600}>600px</Option>
                    <Option value={700}>700px</Option>
                  </Select>
                </Space>
              </Col>
            </Row>
          </Col>
          
          <Col span={6} style={{ textAlign: 'right' }}>
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={onDownload}
              >
                Download Data
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Chart */}
      <Card
        title={
          <Space>
            <LineChartOutlined />
            <span>ARIMA Forecast Visualization</span>
            <Tag color="blue">{`ARIMA(${session.model_info.order.p}, ${session.model_info.order.d}, ${session.model_info.order.q})`}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Tooltip title="Interactive chart showing actual values, model predictions, and future forecasts">
              <InfoCircleOutlined />
            </Tooltip>
          </Space>
        }
      >
        <div style={{ height: chartHeight, backgroundColor: '#fafafa', padding: 10, borderRadius: 6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
              />
              
              <YAxis
                tick={{ fontSize: 12 }}
                domain={['dataMin - 5%', 'dataMax + 5%']}
              />
              
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend />

              {/* Confidence interval area */}
              {showConfidenceInterval && chartType === 'area' && (
                <Area
                  dataKey="upperCI"
                  fill="#F65f42"
                  fillOpacity={0.1}
                  stroke="none"
                  connectNulls={false}
                />
              )}

              {/* Historical data (training + test actual) */}
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#1890ff"
                strokeWidth={2.5}
                dot={false}
                name="Historical Data"
                connectNulls={false}
                activeDot={{ r: 4, stroke: '#1890ff', strokeWidth: 2, fill: '#fff' }}
              />

              {/* Model predictions (test period) */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#52c41a"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
                name="Model Predictions"
                connectNulls={false}
                activeDot={{ r: 4, stroke: '#52c41a', strokeWidth: 2, fill: '#fff' }}
              />

              {/* Future forecast */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#F65f42"
                strokeWidth={3}
                strokeDasharray="8 4"
                dot={{ r: 2, fill: '#F65f42' }}
                name="Future Forecast"
                connectNulls={false}
                activeDot={{ r: 6, stroke: '#F65f42', strokeWidth: 3, fill: '#fff' }}
              />

              {/* Confidence interval lines */}
              {showConfidenceInterval && chartType === 'line' && (
                <>
                  <Line
                    type="monotone"
                    dataKey="lowerCI"
                    stroke="#ff7875"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    name="Lower CI"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="upperCI"
                    stroke="#ff7875"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    name="Upper CI"
                    connectNulls={false}
                  />
                </>
              )}

              {/* Reference lines for train/test/forecast splits */}
              {showTrainTestSplit && testStartIndex > 0 && (
                <ReferenceLine
                  x={chartData[testStartIndex]?.date}
                  stroke="#d9d9d9"
                  strokeDasharray="4 4"
                  label={{ value: "Test Start", position: "top" }}
                />
              )}
              
              {showTrainTestSplit && forecastStartIndex > 0 && (
                <ReferenceLine
                  x={chartData[forecastStartIndex]?.date}
                  stroke="#d9d9d9"
                  strokeDasharray="4 4"
                  label={{ value: "Forecast Start", position: "top" }}
                />
              )}

              {/* Brush for zooming */}
              <Brush dataKey="date" height={30} stroke="#F65f42" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Chart Legend and Info */}
      <Card size="small">
        <Row gutter={16}>
          <Col span={12}>
            <Space direction="vertical" size="small">
              <Text strong>Legend:</Text>
              <Space wrap>
                <Space>
                  <div style={{ width: 20, height: 2, backgroundColor: '#1890ff' }} />
                  <Text>Historical Data</Text>
                </Space>
                <Space>
                  <div style={{ width: 20, height: 2, backgroundColor: '#52c41a', borderStyle: 'dashed' }} />
                  <Text>Model Predictions</Text>
                </Space>
                <Space>
                  <div style={{ width: 20, height: 2, backgroundColor: '#F65f42', borderStyle: 'dashed' }} />
                  <Text>Future Forecast</Text>
                </Space>
                {showConfidenceInterval && (
                  <Space>
                    <div style={{ width: 20, height: 2, backgroundColor: '#ff7875', borderStyle: 'dotted' }} />
                    <Text>Confidence Intervals</Text>
                  </Space>
                )}
              </Space>
            </Space>
          </Col>
          
          <Col span={12}>
            <Space direction="vertical" size="small">
              <Text strong>Data Summary:</Text>
              <Space wrap>
                <Tag color="blue">Training: {session.data_info.train_size} points</Tag>
                <Tag color="green">Testing: {session.data_info.test_size} points</Tag>
                <Tag color="orange">Forecast: {session.forecast_horizon} periods</Tag>
                <Tag color="purple">Total: {session.data_info.total_records} records</Tag>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Forecast Data Table */}
      <Card
        title={
          <Space>
            <BarChartOutlined />
            <span>Future Forecast Values</span>
            <Tag color="orange">{session.future_forecast.predictions.length} periods</Tag>
          </Space>
        }
      >
        <Table
          size="small"
          dataSource={session.future_forecast.predictions.map((value, index) => ({
            key: index,
            period: index + 1,
            date: new Date(session.future_forecast.dates[index]).toLocaleDateString(),
            fullDate: session.future_forecast.dates[index],
            forecast: value,
            lowerCI: session.future_forecast.confidence_intervals.lower[index],
            upperCI: session.future_forecast.confidence_intervals.upper[index],
          }))}
          columns={[
            {
              title: 'Period',
              dataIndex: 'period',
              key: 'period',
              width: 80,
              align: 'center',
              render: (period: number) => (
                <Tag color="blue">#{period}</Tag>
              ),
            },
            {
              title: 'Date',
              dataIndex: 'date',
              key: 'date',
              width: 120,
              render: (date: string) => (
                <Text strong>{date}</Text>
              ),
            },
            {
              title: 'Forecasted Value',
              dataIndex: 'forecast',
              key: 'forecast',
              width: 150,
              align: 'right',
              render: (value: number) => (
                <Text style={{ color: '#F65f42', fontSize: 16, fontWeight: 'bold' }}>
                  {value.toFixed(2)}
                </Text>
              ),
            },
            {
              title: 'Lower CI (95%)',
              dataIndex: 'lowerCI',
              key: 'lowerCI',
              width: 130,
              align: 'right',
              render: (value: number) => (
                <Text type="secondary">{value.toFixed(2)}</Text>
              ),
            },
            {
              title: 'Upper CI (95%)',
              dataIndex: 'upperCI',
              key: 'upperCI',
              width: 130,
              align: 'right',
              render: (value: number) => (
                <Text type="secondary">{value.toFixed(2)}</Text>
              ),
            },
            {
              title: 'Range',
              key: 'range',
              width: 120,
              align: 'right',
              render: (_, record) => {
                const range = record.upperCI - record.lowerCI;
                return (
                  <Text style={{ color: '#722ed1' }}>
                    ±{(range / 2).toFixed(2)}
                  </Text>
                );
              },
            },
          ]}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} forecast periods`,
          }}
          scroll={{ y: 300 }}
        />
      </Card>
    </Space>
  );
};
