/**
 * Forecast Chart Component
 * Displays ARIMA forecast results with interactive charts
 */
import React, { useState, useMemo } from "react";
import { Card, Select, Space, Typography, Row, Col, Button } from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DownloadOutlined } from "@ant-design/icons";
import type { TrainingSession, ChartDataPoint } from "../types";
import { format, parseISO } from "date-fns";

const { Title, Text } = Typography;
const { Option } = Select;

interface ForecastChartProps {
  session: TrainingSession;
  forecastPeriod: 7 | 30;
  onForecastPeriodChange: (period: 7 | 30) => void;
  onDownload?: () => void;
}

const ForecastChart: React.FC<ForecastChartProps> = ({
  session,
  forecastPeriod,
  onForecastPeriodChange,
  onDownload,
}) => {
  // Removed unused state variables - simplified chart display

  // Prepare chart data
  const chartData = useMemo(() => {
    const data: ChartDataPoint[] = [];

    // Add historical test data (blue line - actual historical sales)
    // Show more historical context for better balance
    if (false) {
      // Always use full historical data
      // Disable test data to show full historical
      session.test_forecast.dates.forEach((date, index) => {
        const actual = Math.round(session.test_forecast.actual_values[index]);
        const lower_ci = Math.round(
          session.test_forecast.confidence_intervals.lower[index]
        );
        const upper_ci = Math.round(
          session.test_forecast.confidence_intervals.upper[index]
        );

        data.push({
          date: format(parseISO(date), "MMM dd"),
          actual, // Historical sales (blue line)
          predicted: undefined, // No prediction for historical period
          lower_ci,
          upper_ci,
          timestamp: parseISO(date).getTime(),
        });
      });
    } else if (session.historical_data) {
      // Show substantial historical data for better visual balance (aim for 80% historical, 20% forecast)
      const totalHistorical = session.historical_data.dates.length;
      // For 30-day forecast, show last 120 days of historical data for good balance
      const optimalHistoricalDays = forecastPeriod * 4; // 4:1 ratio
      const showLast = Math.min(totalHistorical, optimalHistoricalDays);
      const startIndex = Math.max(0, totalHistorical - showLast);

      session.historical_data.dates.slice(startIndex).forEach((date, index) => {
        const actualIndex = startIndex + index;
        const actual = session.historical_data.values[actualIndex]; // Keep decimals for variation

        data.push({
          date: format(parseISO(date), "MMM dd"),
          actual, // Historical sales (blue line)
          predicted: undefined, // No prediction for historical period
          lower_ci: undefined,
          upper_ci: undefined,
          timestamp: parseISO(date).getTime(),
        });
      });
    }

    // Add future forecast data (red line - forecasted sales)
    const futureDates = session.future_forecast.dates.slice(0, forecastPeriod);
    futureDates.forEach((date, index) => {
      const predicted = session.future_forecast.predictions[index]; // Keep decimals for variation
      const lower_ci =
        session.future_forecast.confidence_intervals.lower[index];
      const upper_ci =
        session.future_forecast.confidence_intervals.upper[index];

      data.push({
        date: format(parseISO(date), "MMM dd, yyyy"),
        actual: undefined, // No historical data for future period
        predicted, // Forecasted sales (red line)
        lower_ci,
        upper_ci,
        timestamp: parseISO(date).getTime(),
      });
    });

    // Sort by timestamp
    return data.sort((a, b) => a.timestamp - b.timestamp);
  }, [session, forecastPeriod]);

  // Calculate balanced Y-axis domain based on data distribution
  const yAxisDomain = useMemo(() => {
    const allValues: number[] = [];

    // Collect all actual and predicted values
    chartData.forEach((point) => {
      if (point.actual !== undefined) allValues.push(point.actual);
      if (point.predicted !== undefined) allValues.push(point.predicted);
      if (point.lower_ci !== undefined) allValues.push(point.lower_ci);
      if (point.upper_ci !== undefined) allValues.push(point.upper_ci);
    });

    if (allValues.length === 0) return [0, 100];

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;

    // Add 10% padding on both sides for better visualization
    const padding = range * 0.1;
    const domainMin = Math.max(0, minValue - padding);
    const domainMax = maxValue + padding;

    return [Math.floor(domainMin), Math.ceil(domainMax)];
  }, [chartData]);

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold">{`Date: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${Math.round(entry.value || 0)} pizzas`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Chart controls (simplified)
  const renderControls = () => (
    <Row gutter={16} align="middle">
      <Col>
        <Space>
          <Text strong>Forecast Period:</Text>
          <Select
            value={forecastPeriod}
            onChange={onForecastPeriodChange}
            style={{ width: 120 }}
          >
            <Option value={7}>7 days</Option>
            <Option value={30}>30 days</Option>
          </Select>
        </Space>
      </Col>
      <Col flex="auto" />
      {/* <Col>
        <Button icon={<DownloadOutlined />} onClick={onDownload}>
          Export
        </Button>
      </Col> */}
    </Row>
  );

  // Render line chart
  const renderLineChart = () => (
    <LineChart
      data={chartData}
      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
      <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 12 }} />
      <YAxis
        stroke="#666"
        tick={{ fontSize: 12 }}
        tickFormatter={(value) => Math.round(value).toLocaleString()}
        domain={yAxisDomain}
      />
      <RechartsTooltip content={<CustomTooltip />} />
      <Legend />

      {/* Historical Sales (blue line) */}
      <Line
        type="monotone"
        dataKey="actual"
        stroke="#1890ff"
        strokeWidth={3}
        dot={{ fill: "#1890ff", r: 4 }}
        name="Historical Sales"
        connectNulls={false}
      />

      {/* Forecasted Sales (red line) */}
      <Line
        type="monotone"
        dataKey="predicted"
        stroke="#ff4d4f"
        strokeWidth={3}
        dot={{ fill: "#ff4d4f", r: 4 }}
        name="Forecasted Sales"
        connectNulls={false}
      />
    </LineChart>
  );

  return (
    <Card
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            📈 Sales Forecast Visualization
          </Title>
        </Space>
      }
      extra={renderControls()}
      size="default"
    >
      <div style={{ height: 500, width: "100%" }}>
        <ResponsiveContainer>{renderLineChart()}</ResponsiveContainer>
      </div>

      {/* Chart summary */}
      <Row
        gutter={16}
        style={{
          marginTop: 16,
          padding: "16px 0",
          borderTop: "1px solid #f0f0f0",
        }}
      >
        <Col span={6}>
          <Text type="secondary">📘 Historical Data:</Text>
          <br />
          <Text strong style={{ color: "#1890ff" }}>
            Blue Line
          </Text>
        </Col>
        <Col span={6}>
          <Text type="secondary">📕 Forecasted Sales:</Text>
          <br />
          <Text strong style={{ color: "#ff4d4f" }}>
            Red Line
          </Text>
        </Col>
        <Col span={6}>
          <Text type="secondary">Forecast Period:</Text>
          <br />
          <Text strong>{forecastPeriod} days ahead</Text>
        </Col>
        <Col span={6}>
          <Text type="secondary">Confidence Level:</Text>
          <br />
          <Text strong>
            {(
              session.future_forecast.confidence_intervals.confidence_level *
              100
            ).toFixed(0)}
            %
          </Text>
        </Col>
      </Row>
    </Card>
  );
};

export default ForecastChart;
