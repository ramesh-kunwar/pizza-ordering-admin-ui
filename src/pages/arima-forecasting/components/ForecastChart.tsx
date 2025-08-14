import React from "react";
import { Card, Typography, Switch, Space } from "antd";
import { LineChartOutlined } from "@ant-design/icons";
import {
  LineChart,
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
import { format } from "date-fns";
import type { TimeSeriesDataPoint, ForecastResult } from "../types/forecasting";
// import { TimeSeriesDataPoint, ForecastResult } from '../types/forecasting';

const { Title } = Typography;

interface ForecastChartProps {
  timeSeries: TimeSeriesDataPoint[];
  additionalSeries?: { [field: string]: TimeSeriesDataPoint[] };
  forecast: ForecastResult;
  showConfidenceInterval?: boolean;
  primaryField: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  timeSeries,
  additionalSeries,
  forecast,
  showConfidenceInterval = true,
  primaryField,
}) => {
  const [showCI, setShowCI] = React.useState(showConfidenceInterval);

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
  const forecastStartIndex = timeSeries.length - 1;
  const forecastStartDate =
    timeSeries[timeSeries.length - 1]?.date.toLocaleDateString();

  return (
    <Card
      title={
        <Space>
          <LineChartOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Time Series Forecast
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
  );
};
