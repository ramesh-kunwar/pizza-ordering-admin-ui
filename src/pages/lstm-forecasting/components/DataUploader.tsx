import React, { useState, useCallback } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  Typography, 
  Space, 
  Table, 
  Alert, 
  Row, 
  Col, 
  Select, 
  Form, 
  Statistic,
  message,
  Progress
} from 'antd';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined,
  WarningOutlined 
} from '@ant-design/icons';
import { LSTMDataProcessor } from '../lib/data-processor';
import type { ProcessedDataset, FileUploadState } from '../types/lstm-forecasting';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface DataUploaderProps {
  onDataUploaded: (dataset: ProcessedDataset) => void;
  uploadState: FileUploadState;
  onUploadStateChange: (state: Partial<FileUploadState>) => void;
}

export const DataUploader: React.FC<DataUploaderProps> = ({
  onDataUploaded,
  uploadState,
  onUploadStateChange
}) => {
  const [form] = Form.useForm();
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  } | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [processingConfig, setProcessingConfig] = useState({
    dateField: '',
    valueField: '',
    aggregationType: 'sum' as 'sum' | 'mean' | 'count',
    frequency: 'daily' as 'hourly' | 'daily' | 'weekly' | 'monthly',
  });

  const handleFileUpload = useCallback(async (file: File) => {
    onUploadStateChange({ 
      isUploading: true, 
      progress: 10, 
      error: null, 
      file 
    });

    try {
      onUploadStateChange({ progress: 30 });
      
      // Parse CSV file
      const rawData = await LSTMDataProcessor.parseCSV(file);
      
      onUploadStateChange({ progress: 50 });
      
      // Validate dataset
      const validation = LSTMDataProcessor.validateDataset(rawData);
      setValidationResult(validation);
      
      onUploadStateChange({ progress: 70 });
      
      if (rawData.length > 0) {
        const fields = Object.keys(rawData[0]);
        setAvailableFields(fields);
        
        // Auto-detect likely date and value fields
        const dateField = fields.find(f => 
          f.toLowerCase().includes('date') || 
          f.toLowerCase().includes('time') || 
          f.toLowerCase().includes('timestamp')
        ) || fields[0];
        
        const valueField = fields.find(f => 
          f.toLowerCase().includes('sales') || 
          f.toLowerCase().includes('quantity') || 
          f.toLowerCase().includes('amount') || 
          f.toLowerCase().includes('price') || 
          f.toLowerCase().includes('revenue')
        ) || fields.find(f => {
          const sample = rawData.slice(0, 5).map(row => row[f]);
          return sample.every(val => !isNaN(Number(val)));
        }) || fields[1];
        
        setProcessingConfig(prev => ({
          ...prev,
          dateField,
          valueField
        }));
        
        form.setFieldsValue({
          dateField,
          valueField,
          aggregationType: 'sum',
          frequency: 'daily'
        });
      }
      
      onUploadStateChange({ 
        progress: 100, 
        isUploading: false, 
        preview: rawData.slice(0, 10)
      });
      
      if (validation.isValid) {
        message.success(`File uploaded successfully! ${rawData.length} records loaded.`);
      } else {
        message.warning('File uploaded with validation warnings. Please review before processing.');
      }
      
    } catch (error) {
      console.error('File upload error:', error);
      onUploadStateChange({
        isUploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'File upload failed'
      });
      message.error('Failed to upload file');
    }
  }, [onUploadStateChange, form]);

  const processDataset = useCallback(async () => {
    if (!uploadState.file || !uploadState.preview.length) {
      message.error('Please upload a file first');
      return;
    }

    if (!processingConfig.dateField || !processingConfig.valueField) {
      message.error('Please select date and value fields');
      return;
    }

    try {
      onUploadStateChange({ isUploading: true, progress: 0 });
      
      // Re-parse the full dataset
      const rawData = await LSTMDataProcessor.parseCSV(uploadState.file);
      
      onUploadStateChange({ progress: 30 });
      
      // Process time series data
      const processedDataset = LSTMDataProcessor.processTimeSeriesData(rawData, {
        dateField: processingConfig.dateField,
        valueField: processingConfig.valueField,
        aggregationType: processingConfig.aggregationType,
        frequency: processingConfig.frequency,
      });
      
      onUploadStateChange({ progress: 80 });
      
      // Detect frequency if auto
      const detectedFrequency = LSTMDataProcessor.detectTimeFrequency(processedDataset.timeSeries);
      if (detectedFrequency !== processingConfig.frequency) {
        console.log(`📊 Frequency adjusted: ${processingConfig.frequency} → ${detectedFrequency}`);
      }
      
      onUploadStateChange({ progress: 100, isUploading: false });
      
      onDataUploaded(processedDataset);
      message.success(`Dataset processed successfully! ${processedDataset.timeSeries.length} time series points created.`);
      
    } catch (error) {
      console.error('Data processing error:', error);
      onUploadStateChange({
        isUploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Data processing failed'
      });
      message.error('Failed to process dataset');
    }
  }, [uploadState.file, uploadState.preview, processingConfig, onUploadStateChange, onDataUploaded]);

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    beforeUpload: (file: File) => {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        message.error('Please upload a CSV file');
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        message.error('File size must be less than 10MB');
        return false;
      }
      handleFileUpload(file);
      return false; // Prevent automatic upload
    },
    showUploadList: false,
  };

  const previewColumns = [
    {
      title: 'Field',
      dataIndex: 'field',
      key: 'field',
      width: 150,
    },
    ...uploadState.preview.slice(0, 5).map((_, index) => ({
      title: `Row ${index + 1}`,
      dataIndex: `row_${index}`,
      key: `row_${index}`,
      width: 120,
    })),
  ];

  const previewData = availableFields.map(field => {
    const row: any = { field, key: field };
    uploadState.preview.slice(0, 5).forEach((dataRow, index) => {
      row[`row_${index}`] = String(dataRow[field] || '').slice(0, 50);
    });
    return row;
  });

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Upload Area */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>LSTM Data Upload</span>
          </Space>
        }
      >
        <Paragraph>
          Upload your pizza sales CSV file for LSTM neural network forecasting. The system supports time series data with dates and numeric values.
        </Paragraph>
        
        <Dragger {...uploadProps} style={{ padding: '20px 0' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">
            <Title level={4}>Click or drag CSV file to upload</Title>
          </p>
          <p className="ant-upload-hint">
            Supports CSV files up to 10MB. Recommended: 200+ data points for optimal LSTM training.
          </p>
        </Dragger>

        {uploadState.isUploading && (
          <div style={{ marginTop: 16 }}>
            <Progress 
              percent={uploadState.progress} 
              status="active"
              strokeColor="#1890ff"
            />
            <Text type="secondary">Processing your data...</Text>
          </div>
        )}

        {uploadState.error && (
          <Alert
            message="Upload Error"
            description={uploadState.error}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <Card 
          title="Data Validation" 
          size="small"
          extra={
            validationResult.isValid ? (
              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            ) : (
              <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
            )
          }
        >
          {validationResult.isValid ? (
            <Alert
              message="Data validation passed"
              description="Your dataset is suitable for LSTM forecasting"
              type="success"
              showIcon
            />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {validationResult.errors.length > 0 && (
                <Alert
                  message="Validation Errors"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  }
                  type="error"
                  showIcon
                />
              )}
              {validationResult.suggestions.length > 0 && (
                <Alert
                  message="Suggestions"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {validationResult.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  }
                  type="info"
                  showIcon
                />
              )}
            </Space>
          )}
        </Card>
      )}

      {/* Configuration Panel */}
      {uploadState.preview.length > 0 && (
        <Card title="Data Configuration" size="small">
          <Form
            form={form}
            layout="vertical"
            onValuesChange={(_, allValues) => setProcessingConfig(prev => ({ ...prev, ...allValues }))}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Date Field"
                  name="dateField"
                  rules={[{ required: true, message: 'Please select a date field' }]}
                >
                  <Select
                    placeholder="Select date column"
                    options={availableFields.map(field => ({
                      label: field,
                      value: field
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Value Field (Target Variable)"
                  name="valueField"
                  rules={[{ required: true, message: 'Please select a value field' }]}
                >
                  <Select
                    placeholder="Select value column"
                    options={availableFields.map(field => ({
                      label: field,
                      value: field
                    }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Aggregation Type"
                  name="aggregationType"
                >
                  <Select>
                    <Select.Option value="sum">Sum</Select.Option>
                    <Select.Option value="mean">Average</Select.Option>
                    <Select.Option value="count">Count</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Time Frequency"
                  name="frequency"
                >
                  <Select>
                    <Select.Option value="daily">Daily</Select.Option>
                    <Select.Option value="weekly">Weekly</Select.Option>
                    <Select.Option value="monthly">Monthly</Select.Option>
                    <Select.Option value="hourly">Hourly</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Button 
            type="primary" 
            size="large" 
            onClick={processDataset}
            loading={uploadState.isUploading}
            disabled={!processingConfig.dateField || !processingConfig.valueField}
            style={{ marginTop: 16 }}
          >
            Process Dataset for LSTM Training
          </Button>
        </Card>
      )}

      {/* Data Preview */}
      {uploadState.preview.length > 0 && (
        <Card title="Data Preview" size="small">
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Statistic
                title="Total Records"
                value={uploadState.preview.length}
                suffix="rows"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Fields Detected"
                value={availableFields.length}
                suffix="columns"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="File Size"
                value={uploadState.file ? (uploadState.file.size / 1024).toFixed(1) : 0}
                suffix="KB"
              />
            </Col>
          </Row>

          <Table
            columns={previewColumns}
            dataSource={previewData}
            pagination={false}
            scroll={{ x: 800, y: 300 }}
            size="small"
          />
          
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            Showing first 5 rows and columns. Full dataset will be processed after configuration.
          </Text>
        </Card>
      )}
    </Space>
  );
};
