import React, { useEffect, useRef } from "react";
import { Card, Typography, Space, Row, Col, Statistic, Tag } from "antd";
import { LineChartOutlined } from "@ant-design/icons";
import type {
  TimeSeriesDataPoint,
  LSTMForecastResult,
} from "../types/lstm-forecasting";

const { Title, Text } = Typography;

interface ForecastChartProps {
  timeSeries: TimeSeriesDataPoint[];
  forecast: LSTMForecastResult;
  showConfidenceInterval?: boolean;
  primaryField?: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  timeSeries,
  forecast,
  showConfidenceInterval = true,
  primaryField = "Value",
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !timeSeries || !forecast) return;

    // Dynamic import of Plotly to avoid SSR issues
    import("plotly.js-dist-min")
      .then((Plotly) => {
        const container = chartRef.current!;

        // Prepare historical data
        const historicalDates = timeSeries.map(
          (point) => point.date.toISOString().split("T")[0]
        );
        const historicalValues = timeSeries.map((point) => point.value);

        // Prepare forecast data
        const forecastDates = forecast.predictions.map(
          (point) => point.date.toISOString().split("T")[0]
        );
        const forecastValues = forecast.predictions.map((point) => point.value);

        // Create traces
        const traces: any[] = [
          // Historical data
          {
            x: historicalDates,
            y: historicalValues,
            type: "scatter",
            mode: "lines",
            name: `Historical ${primaryField}`,
            line: {
              color: "#1890ff",
              width: 2,
            },
            hovertemplate:
              "<b>%{fullData.name}</b><br>" +
              "Date: %{x}<br>" +
              "Value: %{y:,.0f}<br>" +
              "<extra></extra>",
          },
          // Forecast data
          {
            x: forecastDates,
            y: forecastValues,
            type: "scatter",
            mode: "lines+markers",
            name: "LSTM Forecast",
            line: {
              color: "#52c41a",
              width: 3,
              dash: "dash",
            },
            marker: {
              color: "#52c41a",
              size: 6,
            },
            hovertemplate:
              "<b>%{fullData.name}</b><br>" +
              "Date: %{x}<br>" +
              "Predicted: %{y:,.0f}<br>" +
              "<extra></extra>",
          },
        ];

        // Add confidence intervals if enabled
        if (showConfidenceInterval && forecast.confidenceIntervals) {
          // Upper bound
          traces.push({
            x: forecastDates,
            y: forecast.confidenceIntervals.upper,
            type: "scatter",
            mode: "lines",
            name: "Upper CI (95%)",
            line: {
              color: "rgba(82, 196, 26, 0.2)",
              width: 1,
            },
            showlegend: false,
            hoverinfo: "skip",
          });

          // Lower bound (filled area)
          traces.push({
            x: forecastDates,
            y: forecast.confidenceIntervals.lower,
            type: "scatter",
            mode: "lines",
            name: "Confidence Interval",
            line: {
              color: "rgba(82, 196, 26, 0.2)",
              width: 1,
            },
            fill: "tonexty",
            fillcolor: "rgba(82, 196, 26, 0.1)",
            hovertemplate:
              "<b>95% Confidence Interval</b><br>" +
              "Date: %{x}<br>" +
              "Lower: %{y:,.0f}<br>" +
              "Upper: %{customdata:,.0f}<br>" +
              "<extra></extra>",
            customdata: forecast.confidenceIntervals.upper,
          });
        }

        // Layout configuration
        const layout = {
          title: {
            text: `LSTM Sales Forecasting - ${forecast.horizon} Day Prediction`,
            font: { size: 16, color: "#262626" },
            x: 0.05,
            xanchor: "left",
          },
          xaxis: {
            title: "Date",
            type: "date",
            showgrid: true,
            gridcolor: "#f0f0f0",
            tickformat: "%Y-%m-%d",
            tickangle: -45,
          },
          yaxis: {
            title: primaryField,
            showgrid: true,
            gridcolor: "#f0f0f0",
            tickformat: ",.0f",
          },
          legend: {
            x: 0.02,
            y: 0.98,
            bgcolor: "rgba(255, 255, 255, 0.8)",
            bordercolor: "#d9d9d9",
            borderwidth: 1,
          },
          hovermode: "x unified",
          showlegend: true,
          plot_bgcolor: "#fafafa",
          paper_bgcolor: "white",
          margin: { l: 60, r: 40, t: 80, b: 60 },
          height: 500,
          font: { family: "Arial, sans-serif", size: 12 },
          annotations: [
            {
              x: forecastDates[0],
              y: Math.max(...historicalValues) * 0.9,
              text: "LSTM Prediction Starts",
              showarrow: true,
              arrowhead: 2,
              arrowcolor: "#722ed1",
              font: { color: "#722ed1", size: 11 },
              bgcolor: "rgba(114, 46, 209, 0.1)",
              bordercolor: "#722ed1",
              borderwidth: 1,
            },
          ],
        };

        // Plot configuration
        const config = {
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: [
            "pan2d",
            "lasso2d",
            "select2d",
            "autoScale2d",
            "hoverClosestCartesian",
            "hoverCompareCartesian",
            "toggleSpikelines",
          ],
          displaylogo: false,
          toImageButtonOptions: {
            format: "png",
            filename: "lstm_forecast",
            height: 500,
            width: 800,
            scale: 2,
          },
        };

        // Clear and create plot
        container.innerHTML = "";
        Plotly.newPlot(container, traces, layout, config);

        // Add trend analysis
        const recentHistorical = historicalValues.slice(-30);
        const recentTrend =
          recentHistorical[recentHistorical.length - 1] - recentHistorical[0];
        const forecastTrend =
          forecastValues[forecastValues.length - 1] - forecastValues[0];

        console.log(`📈 LSTM Forecast Analysis:`);
        console.log(
          `  Recent 30-day trend: ${
            recentTrend > 0 ? "+" : ""
          }${recentTrend.toFixed(1)}`
        );
        console.log(
          `  Forecast trend: ${
            forecastTrend > 0 ? "+" : ""
          }${forecastTrend.toFixed(1)}`
        );
        console.log(
          `  Model confidence: ${(forecast.modelConfidence * 100).toFixed(1)}%`
        );
      })
      .catch((error) => {
        console.error("Failed to load Plotly:", error);
      });

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.innerHTML = "";
      }
    };
  }, [timeSeries, forecast, showConfidenceInterval, primaryField]);

  // Calculate trend indicators
  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return { direction: "stable", percentage: 0 };

    const start = values[0];
    const end = values[values.length - 1];
    const percentage = ((end - start) / start) * 100;

    let direction: "increasing" | "decreasing" | "stable" = "stable";
    if (Math.abs(percentage) > 5) {
      direction = percentage > 0 ? "increasing" : "decreasing";
    }

    return { direction, percentage };
  };

  const forecastValues = forecast.predictions.map((p) => p.value);
  const forecastTrend = calculateTrend(forecastValues);
  const recentHistorical = timeSeries.slice(-30).map((p) => p.value);
  const historicalTrend = calculateTrend(recentHistorical);

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return "green";
    if (confidence > 0.6) return "orange";
    return "red";
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      default:
        return "➡️";
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      {/* Chart Card */}
      <Card
        title={
          <Space>
            <LineChartOutlined />
            <span>LSTM Neural Network Forecast</span>
          </Space>
        }
        size="small"
      >
        <div ref={chartRef} style={{ width: "100%", height: "500px" }} />
      </Card>

      {/* Forecast Analysis */}
      <Card title="Forecast Analysis" size="small">
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Statistic
              title="Model Confidence"
              value={(forecast.modelConfidence * 100).toFixed(1)}
              suffix="%"
              valueStyle={{
                color: getConfidenceColor(forecast.modelConfidence),
                fontSize: "20px",
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Forecast Period"
              value={forecast.horizon}
              suffix="days"
              valueStyle={{ color: "#1890ff", fontSize: "20px" }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Avg Daily Forecast"
              value={Math.round(
                forecastValues.reduce((a, b) => a + b, 0) /
                  forecastValues.length
              )}
              valueStyle={{ color: "#52c41a", fontSize: "20px" }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total Forecast"
              value={Math.round(forecastValues.reduce((a, b) => a + b, 0))}
              valueStyle={{ color: "#722ed1", fontSize: "20px" }}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card size="small" style={{ backgroundColor: "#f6ffed" }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                  {/* <TrendingUpOutlined style={{ color: "#52c41a" }} /> */}
                  <Text strong>Historical Trend (Last 30 Days)</Text>
                </Space>
                <Space>
                  <Text style={{ fontSize: "24px" }}>
                    {getTrendIcon(historicalTrend.direction)}
                  </Text>
                  <div>
                    <Text strong style={{ fontSize: "16px" }}>
                      {historicalTrend.direction.charAt(0).toUpperCase() +
                        historicalTrend.direction.slice(1)}
                    </Text>
                    <br />
                    <Text type="secondary">
                      {historicalTrend.percentage > 0 ? "+" : ""}
                      {historicalTrend.percentage.toFixed(1)}%
                    </Text>
                  </div>
                </Space>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ backgroundColor: "#f0f9ff" }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space>
                  {/* <TrendingUpOutlined style={{ color: "#1890ff" }} /> */}
                  <Text strong>Forecast Trend</Text>
                </Space>
                <Space>
                  <Text style={{ fontSize: "24px" }}>
                    {getTrendIcon(forecastTrend.direction)}
                  </Text>
                  <div>
                    <Text strong style={{ fontSize: "16px" }}>
                      {forecastTrend.direction.charAt(0).toUpperCase() +
                        forecastTrend.direction.slice(1)}
                    </Text>
                    <br />
                    <Text type="secondary">
                      {forecastTrend.percentage > 0 ? "+" : ""}
                      {forecastTrend.percentage.toFixed(1)}%
                    </Text>
                  </div>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Model Performance Summary */}
        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <Space wrap>
              <Tag color="blue">R²: {forecast.metrics.r2.toFixed(3)}</Tag>
              <Tag color="green">MAPE: {forecast.metrics.mape.toFixed(1)}%</Tag>
              <Tag color="orange">RMSE: {forecast.metrics.rmse.toFixed(1)}</Tag>
              <Tag color="purple">
                Directional Accuracy:{" "}
                {forecast.metrics.directionalAccuracy.toFixed(1)}%
              </Tag>
            </Space>
          </Col>
        </Row>

        {/* Insights */}
        <Card
          size="small"
          style={{ marginTop: 16, backgroundColor: "#fffbe6" }}
        >
          <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
            💡 Key Insights
          </Title>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li>
              <Text>
                <Text strong>Model Quality:</Text>{" "}
                {forecast.modelConfidence > 0.8
                  ? "Excellent"
                  : forecast.modelConfidence > 0.6
                  ? "Good"
                  : forecast.modelConfidence > 0.4
                  ? "Fair"
                  : "Poor"}{" "}
                confidence for reliable predictions
              </Text>
            </li>
            <li>
              <Text>
                <Text strong>Trend Continuation:</Text>{" "}
                {Math.sign(historicalTrend.percentage) ===
                Math.sign(forecastTrend.percentage)
                  ? "LSTM predicts trend continuation"
                  : "LSTM predicts trend reversal"}
              </Text>
            </li>
            <li>
              <Text>
                <Text strong>Accuracy:</Text>{" "}
                {forecast.metrics.mape < 10
                  ? "Highly accurate"
                  : forecast.metrics.mape < 20
                  ? "Moderately accurate"
                  : "Consider model tuning for better accuracy"}{" "}
                predictions (MAPE: {forecast.metrics.mape.toFixed(1)}%)
              </Text>
            </li>
            <li>
              <Text>
                <Text strong>Pattern Recognition:</Text> LSTM captured{" "}
                {forecast.metrics.directionalAccuracy > 70
                  ? "strong"
                  : forecast.metrics.directionalAccuracy > 60
                  ? "moderate"
                  : "weak"}{" "}
                directional patterns (
                {forecast.metrics.directionalAccuracy.toFixed(1)}% accuracy)
              </Text>
            </li>
          </ul>
        </Card>
      </Card>
    </Space>
  );
};
