/**
 * Forecast Table Component
 * Displays forecast data in table format with export functionality
 */
import React, { useMemo } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Button,
  Tag,
  Tooltip,
  Select,
  Row,
  Col,
} from 'antd';
import { DownloadOutlined, TableOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TrainingSession, ForecastTableData } from '../types';
import { format, parseISO } from 'date-fns';

const { Title, Text } = Typography;

interface ForecastTableProps {
  session: TrainingSession;
  forecastPeriod: number;
}

const ForecastTable: React.FC<ForecastTableProps> = ({
  session,
  forecastPeriod,
}) => {
  // Prepare table data
  const tableData = useMemo(() => {
    const data: ForecastTableData[] = [];

    // Get future forecast data limited by forecastPeriod
    const futureDates = session.future_forecast.dates.slice(0, forecastPeriod);
    
    futureDates.forEach((date, index) => {
      const predicted = Math.round(session.future_forecast.predictions[index]);
      const lower = Math.round(session.future_forecast.confidence_intervals.lower[index]);
      const upper = Math.round(session.future_forecast.confidence_intervals.upper[index]);

      data.push({
        key: `forecast-${index}`,
        date,
        predicted_value: predicted,
        lower_bound: lower,
        upper_bound: upper,
        formatted_date: format(parseISO(date), 'EEE, MMM dd, yyyy'),
      });
    });

    return data;
  }, [session, forecastPeriod]);

  // Table columns configuration
  const columns: ColumnsType<ForecastTableData> = [
    {
      title: 'Date',
      dataIndex: 'formatted_date',
      key: 'date',
      width: 200,
      sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      render: (text, record) => (
        <Space direction="vertical" size="small">
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {format(parseISO(record.date), 'yyyy-MM-dd')}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Predicted Sales',
      dataIndex: 'predicted_value',
      key: 'predicted_value',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.predicted_value - b.predicted_value,
      render: (value: number) => (
        <Space>
          <Text strong style={{ color: '#1890ff' }}>
            {value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Lower Bound (85% CI)',
      dataIndex: 'lower_bound',
      key: 'lower_bound',
      width: 150,
      align: 'right',
      render: (value: number) => (
        <Text type="secondary">
          {Math.round(value).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Upper Bound (85% CI)',
      dataIndex: 'upper_bound',
      key: 'upper_bound',
      width: 150,
      align: 'right',
      render: (value: number) => (
        <Text type="secondary">
          {Math.round(value).toLocaleString()}
        </Text>
      ),
    },
  ];

  // Export data to CSV
  const handleExportCSV = () => {
    const csvData = [
      ['Date', 'Predicted Sales', 'Lower Bound', 'Upper Bound'],
      ...tableData.map(row => [
        row.formatted_date,
        row.predicted_value.toFixed(2),
        row.lower_bound.toFixed(2),
        row.upper_bound.toFixed(2),
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `forecast_data_${forecastPeriod}days_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const predictions = tableData.map(row => row.predicted_value);
    const total = predictions.reduce((sum, val) => sum + val, 0);
    const average = total / predictions.length;
    const min = Math.min(...predictions);
    const max = Math.max(...predictions);

    return { total, average, min, max };
  }, [tableData]);

  return (
    <Card
      title={
        <Space>
          <TableOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Sales Forecast Data
          </Title>
        </Space>
      }
      extra={
        <Row gutter={16} align="middle">

          <Col>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
          </Col>
        </Row>
      }
      size="default"
    >
      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Text type="secondary">Total Forecast</Text>
            <br />
            <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
              {summaryStats.total.toLocaleString()}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Text type="secondary">Daily Average</Text>
            <br />
            <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
              {summaryStats.average.toLocaleString('en-US', { 
                maximumFractionDigits: 0 
              })}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Text type="secondary">Minimum</Text>
            <br />
            <Text strong style={{ fontSize: 18, color: '#faad14' }}>
              {summaryStats.min.toLocaleString('en-US', { 
                maximumFractionDigits: 0 
              })}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Text type="secondary">Maximum</Text>
            <br />
            <Text strong style={{ fontSize: 18, color: '#f5222d' }}>
              {summaryStats.max.toLocaleString('en-US', { 
                maximumFractionDigits: 0 
              })}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Forecast Table */}
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={{
          total: tableData.length,
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} forecast days`,
        }}
        scroll={{ x: 800 }}
        size="middle"
        bordered
        rowClassName={(_, index) => 
          index % 2 === 0 ? 'table-row-light' : 'table-row-dark'
        }
        className="forecast-table"
      />


    </Card>
  );
};

export default ForecastTable;
