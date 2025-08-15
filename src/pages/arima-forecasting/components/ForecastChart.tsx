import React from "react";
import { Card, Typography, Switch, Space, Statistic, Row, Col } from "antd";
import { LineChartOutlined, RiseOutlined } from "@ant-design/icons";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import type { TimeSeriesDataPoint, ForecastResult } from "../types/forecasting";
// import { TimeSeriesDataPoint, ForecastResult } from '../types/forecasting';

const { Title } = Typography;

interface ForecastChartProps {
  timeSeries: TimeSeriesDataPoint[];
  forecast: ForecastResult;
  showConfidenceInterval?: boolean;
  primaryField: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  timeSeries,
  forecast,
  showConfidenceInterval = true,
  primaryField,
}) => {
  const [showCI, setShowCI] = React.useState(showConfidenceInterval);
  
  // Calculate insights for sales quantity
  const isQuantityField = primaryField === 'quantity';
  const forecastStats = React.useMemo(() => {
    if (!isQuantityField) return null;
    
    const totalForecast = forecast.predictions.reduce((sum, p) => sum + p.value, 0);
    const avgDaily = totalForecast / forecast.predictions.length;
    const maxDaily = Math.max(...forecast.predictions.map(p => p.value));
    const minDaily = Math.min(...forecast.predictions.map(p => p.value));
    
    return { totalForecast, avgDaily, maxDaily, minDaily };
  }, [forecast, isQuantityField]);

  // Combine historical and forecast data for the chart
  const chartData = React.useMemo(() => {
    const data: any[] = [];

    // Add historical data
    timeSeries.forEach((point, index) => {
      data.push({
        date: point.date.toLocaleDateString(),
        timestamp: point.timestamp,
        [primaryField]: point.value,
        type: "historical",
        actualDate: point.date,
      });
    });

    // Add forecast data
    forecast.predictions.forEach((point, index) => {
      data.push({
        date: point.date.toLocaleDateString(),
        timestamp: point.timestamp,
        [primaryField]: point.value,
        [`${primaryField}_forecast`]: point.value,
        lowerCI: showCI ? forecast.confidenceIntervals.lower[index] : undefined,
        upperCI: showCI ? forecast.confidenceIntervals.upper[index] : undefined,
        type: "forecast",
        actualDate: point.date,
      });
    });

    return data.sort(
      (a, b) =>
        new Date(a.actualDate).getTime() - new Date(b.actualDate).getTime()
    );
  }, [timeSeries, forecast, primaryField, showCI]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-medium">{`Date: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value?.toFixed(2) || "N/A"}`}
            </p>
          ))}
          {data.type === "forecast" &&
            showCI &&
            data.lowerCI &&
            data.upperCI && (
              <>
                <p style={{ color: "#ff7875" }}>
                  {`Lower CI: ${data.lowerCI.toFixed(2)}`}
                </p>
                <p style={{ color: "#ff7875" }}>
                  {`Upper CI: ${data.upperCI.toFixed(2)}`}
                </p>
              </>
            )}
        </div>
      );
    }
    return null;
  };

  // Find the point where forecast starts
  const forecastStartDate =
    timeSeries[timeSeries.length - 1]?.date.toLocaleDateString();

  return (
    <div>
      {/* Sales Quantity Insights */}
      {isQuantityField && forecastStats && (
        <Card 
          title={
            <Space>
              <RiseOutlined />
              <Typography.Title level={5} style={{ margin: 0 }}>
                Sales Quantity Forecast Insights
              </Typography.Title>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Total Forecast"
                value={Math.round(forecastStats.totalForecast)}
                suffix="units"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Daily Average"
                value={Math.round(forecastStats.avgDaily)}
                suffix="units/day"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Peak Day"
                value={Math.round(forecastStats.maxDaily)}
                suffix="units"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Lowest Day"
                value={Math.round(forecastStats.minDaily)}
                suffix="units"
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>
        </Card>
      )}
      
      <Card
        title={
          <Space>
            <LineChartOutlined />
            <Title level={4} style={{ margin: 0 }}>
              {isQuantityField ? 'Sales Quantity Forecast' : 'Time Series Forecast'}
            </Title>
          </Space>
        }
        extra={
          <Space>
            <span>Confidence Intervals:</span>
            <Switch checked={showCI} onChange={setShowCI} size="small" />
          </Space>
        }
      >
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={chartData.length > 100 ? Math.ceil(chartData.length / 20) : "preserveStartEnd"}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={["dataMin - 50", "dataMax + 50"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Confidence interval area (if enabled) */}
          {showCI && (
            <Area
              dataKey="upperCI"
              fill="#F65f42"
              fillOpacity={0.1}
              stroke="none"
              connectNulls={false}
            />
          )}

          {/* Historical data line */}
          <Line
            type="monotone"
            dataKey={primaryField}
            stroke="#1890ff"
            strokeWidth={2}
            dot={false}
            name="Historical Data"
            connectNulls={false}
          />

          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey={`${primaryField}_forecast`}
            stroke="#F65f42"
            strokeWidth={2}
            strokeDasharray="8 8"
            dot={false}
            name="Forecast"
            connectNulls={false}
          />

          {/* Reference line at forecast start */}
          <ReferenceLine
            x={forecastStartDate}
            stroke="#d9d9d9"
            strokeDasharray="4 4"
            label={{ value: "Forecast Start", position: "top" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Chart Legend */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          backgroundColor: "#fafafa",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <Space size="large">
          <Space>
            <div
              style={{
                width: 16,
                height: 2,
                backgroundColor: "#1890ff",
                display: "inline-block",
              }}
            />
            <span>Historical Data ({timeSeries.length} points)</span>
          </Space>
          <Space>
            <div
              style={{
                width: 16,
                height: 2,
                backgroundColor: "#F65f42",
                display: "inline-block",
                backgroundImage:
                  "repeating-linear-gradient(to right, #F65f42 0, #F65f42 4px, transparent 4px, transparent 8px)",
              }}
            />
            <span>Forecast ({forecast.predictions.length} points)</span>
          </Space>
          {showCI && (
            <Space>
              <div
                style={{
                  width: 16,
                  height: 8,
                  backgroundColor: "#F65f42",
                  opacity: 0.1,
                  display: "inline-block",
                }}
              />
              <span>
                95% Confidence Interval
              </span>
            </Space>
          )}
        </Space>
      </div>
    </Card>
    </div>
  );
};
