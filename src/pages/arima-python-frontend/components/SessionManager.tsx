import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Statistic,
  Alert
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { arimaApi } from '../services/arimaApi';
import type { SessionSummary, TrainingSession } from '../types';

const { Title, Text } = Typography;

interface SessionManagerProps {
  onSessionSelect: (session: TrainingSession) => void;
  currentSessionId?: string;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  onSessionSelect,
  currentSessionId
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await arimaApi.listSessions();
      if (response.status === 'success' && response.data) {
        setSessions(response.data);
        message.success(`Loaded ${response.data.length} saved sessions`);
      }
    } catch (error: any) {
      console.error('Failed to load sessions:', error);
      message.error(`Failed to load sessions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const response = await arimaApi.getForecast(sessionId);
      if (response.status === 'success' && response.data) {
        onSessionSelect(response.data);
        message.success('Session loaded successfully!');
      }
    } catch (error: any) {
      console.error('Failed to load session:', error);
      message.error(`Failed to load session: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSession = async (sessionId: string, filename: string) => {
    try {
      const blob = await arimaApi.downloadResults(sessionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${sessionId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Session results downloaded!');
    } catch (error: any) {
      console.error('Download failed:', error);
      message.error(`Download failed: ${error.message}`);
    }
  };

  const getPerformanceLevel = (r2: number) => {
    if (r2 >= 0.9) return { color: 'green', level: 'Excellent' };
    if (r2 >= 0.7) return { color: 'blue', level: 'Good' };
    if (r2 >= 0.5) return { color: 'orange', level: 'Fair' };
    return { color: 'red', level: 'Poor' };
  };

  const columns: ColumnsType<SessionSummary> = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      width: 200,
      render: (filename: string) => (
        <Space>
          <FileTextOutlined />
          <Text strong>{filename}</Text>
        </Space>
      ),
    },
    {
      title: 'Model',
      key: 'model_order',
      width: 120,
      render: (_, record) => {
        const order = record.model_order;
        return (
          <Tag color="blue">
            ARIMA({order.p}, {order.d}, {order.q})
          </Tag>
        );
      },
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 150,
      render: (_, record) => {
        const r2 = record.performance_metrics.r2;
        const { color, level } = getPerformanceLevel(r2);
        return (
          <Space direction="vertical" size="small">
            <Text>R²: {r2?.toFixed(3) || 'N/A'}</Text>
            <Tag color={color}>{level}</Tag>
          </Space>
        );
      },
    },
    {
      title: 'Data Points',
      dataIndex: 'total_records',
      key: 'total_records',
      width: 100,
      render: (total: number) => (
        <Text>{total?.toLocaleString() || 'N/A'}</Text>
      ),
    },
    {
      title: 'Upload Time',
      dataIndex: 'upload_time',
      key: 'upload_time',
      width: 180,
      render: (time: string) => (
        <Space>
          <ClockCircleOutlined />
          <Text>{time ? new Date(time).toLocaleString() : 'Unknown'}</Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="Load this session">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleLoadSession(record.session_id)}
              loading={loading}
            >
              Load
            </Button>
          </Tooltip>
          
          <Tooltip title="Download results">
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadSession(record.session_id, record.filename)}
            >
              Download
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Header */}
      <Card size="small">
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <BarChartOutlined />
              <Title level={4} style={{ margin: 0 }}>
                Saved ARIMA Sessions
              </Title>
              <Text type="secondary">
                ({sessions.length} sessions available)
              </Text>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadSessions}
                loading={loading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Current Session Alert */}
      {currentSessionId && (
        <Alert
          message="Active Session"
          description={`Currently viewing session: ${currentSessionId}`}
          type="info"
          showIcon
          closable
        />
      )}

      {/* Sessions Summary */}
      {sessions.length > 0 && (
        <Card size="small">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Total Sessions"
                value={sessions.length}
                prefix={<BarChartOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Avg Performance"
                value={
                  sessions.reduce((acc, s) => acc + (s.performance_metrics.r2 || 0), 0) / 
                  sessions.length
                }
                precision={3}
                suffix="R²"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Total Data Points"
                value={sessions.reduce((acc, s) => acc + (s.total_records || 0), 0)}
                formatter={(value) => value.toLocaleString()}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Best Performance"
                value={Math.max(...sessions.map(s => s.performance_metrics.r2 || 0))}
                precision={3}
                suffix="R²"
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Sessions Table */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text>
            {hasSelected ? `Selected ${selectedRowKeys.length} sessions` : 'Select sessions to perform bulk operations'}
          </Text>
        </div>
        
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={sessions}
          rowKey="session_id"
          loading={loading}
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} sessions`,
          }}
          rowClassName={(record) => 
            record.session_id === currentSessionId ? 'ant-table-row-selected' : ''
          }
          locale={{
            emptyText: (
              <div style={{ padding: 20 }}>
                <Text type="secondary">
                  No saved sessions found. Train a model to create your first session.
                </Text>
              </div>
            ),
          }}
        />
      </Card>

      {/* Instructions */}
      <Card size="small">
        <Alert
          message="Session Management"
          description={
            <Space direction="vertical">
              <Text>• <strong>Load:</strong> Restore a previous training session with all results</Text>
              <Text>• <strong>Download:</strong> Export session data as JSON file</Text>
              <Text>• <strong>Auto-save:</strong> All training sessions are automatically saved</Text>
              <Text>• <strong>Persistence:</strong> Sessions survive server restarts</Text>
            </Space>
          }
          type="info"
          showIcon
        />
      </Card>
    </Space>
  );
};
