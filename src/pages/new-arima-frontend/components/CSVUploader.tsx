/**
 * CSV File Uploader Component
 * Handles file upload, validation, and column selection
 */
import React, { useState } from 'react';
import {
  Upload,
  Card,
  Form,
  Select,
  Button,
  Alert,
  Space,
  Table,
  Typography,
  Divider,
  Row,
  Col,
  Spin,
  message,
} from 'antd';
import { InboxOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';
import type { TrainingConfig } from '../types';
import { newArimaApi } from '../services/arimaApi';
import { 
  shouldAggregateData, 
  aggregateDataByDay, 
  createAggregatedCSVFile,
  validateAggregation,
  type PreprocessingResult 
} from '../utils/dataPreprocessor';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

interface CSVUploaderProps {
  onFileUpload: (file: File, config: TrainingConfig) => void;
  loading?: boolean;
}

interface FileInfo {
  columns: string[];
  preview: any[];
  rowCount: number;
  rawData?: any[];
}

interface ProcessingInfo {
  needsAggregation: boolean;
  preprocessingResult?: PreprocessingResult;
  processedFile?: File;
}

const CSVUploader: React.FC<CSVUploaderProps> = ({ onFileUpload, loading = false }) => {
  const [form] = Form.useForm();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [processingInfo, setProcessingInfo] = useState<ProcessingInfo | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [processingFile, setProcessingFile] = useState(false);

  // Parse full CSV data for preprocessing
  const parseFullCSVData = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            reject(new Error('CSV file must have header and data rows'));
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const data = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            data.push(row);
          }

          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse CSV file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Handle data preprocessing when columns are selected
  const handleColumnChange = async (changedFields: any, allFields: any) => {
    if (!fileInfo?.rawData) return;
    
    const dateColumn = allFields.find((f: any) => f.name[0] === 'dateColumn')?.value;
    const valueColumn = allFields.find((f: any) => f.name[0] === 'valueColumn')?.value;
    
    if (dateColumn && valueColumn && fileInfo.rawData) {
      try {
        const needsAggregation = shouldAggregateData(fileInfo.rawData, dateColumn);
        
        if (needsAggregation) {
          const preprocessingResult = aggregateDataByDay(fileInfo.rawData, dateColumn, valueColumn);
          const validation = validateAggregation(preprocessingResult);
          
          // Create aggregated CSV file
          const processedFile = createAggregatedCSVFile(preprocessingResult.aggregatedData, uploadedFile?.name || 'data.csv');
          
          setProcessingInfo({
            needsAggregation: true,
            preprocessingResult,
            processedFile,
          });
          
          setValidationResult({
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: [
              ...validation.warnings,
              `Data aggregated: ${preprocessingResult.originalRowCount} rows → ${preprocessingResult.aggregatedRowCount} daily totals`,
            ],
          });
        } else {
          setProcessingInfo({
            needsAggregation: false,
          });
        }
      } catch (error: any) {
        message.error('Error preprocessing data: ' + error.message);
      }
    }
  };

  // File upload configuration
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    beforeUpload: async (file) => {
      setProcessingFile(true);
      
      try {
        // Validate file
        const validation = await newArimaApi.validateCSVFile(file);
        setValidationResult(validation);

        if (!validation.isValid) {
          message.error('File validation failed');
          setProcessingFile(false);
          return false;
        }

        // Parse file
        const info = await newArimaApi.parseCSVColumns(file);
        
        // Parse full CSV data for preprocessing
        const fullData = await parseFullCSVData(file);
        const enhancedInfo = { ...info, rawData: fullData };
        setFileInfo(enhancedInfo);
        setUploadedFile(file);

        // Auto-select likely columns
        const dateColumn = info.columns.find(col => 
          /date|time|timestamp/i.test(col)
        ) || info.columns[0];
        
        const valueColumn = info.columns.find(col => 
          /price|revenue|sales|quantity|amount|total|value/i.test(col)
        ) || info.columns[1];

        // Set form defaults
        form.setFieldsValue({
          dateColumn,
          valueColumn,
          testSize: 0.2,
          forecastHorizon: 30,
        });

        message.success('File uploaded successfully!');
      } catch (error: any) {
        message.error(error.message);
        setValidationResult({
          isValid: false,
          errors: [error.message],
          warnings: [],
        });
      } finally {
        setProcessingFile(false);
      }

      return false; // Prevent auto upload
    },
    onRemove: () => {
      setUploadedFile(null);
      setFileInfo(null);
      setProcessingInfo(null);
      setValidationResult(null);
      form.resetFields();
    },
  };

  // Handle form submission
  const handleSubmit = async (values: any) => {
    if (!uploadedFile) {
      message.error('Please upload a CSV file first');
      return;
    }

    // Use processed file if available, otherwise use original
    const fileToUpload = processingInfo?.processedFile || uploadedFile;
    
    const config: TrainingConfig = {
      dateColumn: processingInfo?.needsAggregation ? 'date' : values.dateColumn,
      valueColumn: processingInfo?.needsAggregation ? 'value' : values.valueColumn,
      testSize: values.testSize,
      forecastHorizon: values.forecastHorizon,
    };

    onFileUpload(fileToUpload, config);
  };

  // Render file preview table
  const renderPreview = () => {
    if (!fileInfo) return null;

    const columns = fileInfo.columns.map(col => ({
      title: col,
      dataIndex: col,
      key: col,
      width: 150,
      ellipsis: true,
    }));

    const dataSource = fileInfo.preview.map((row, index) => ({
      ...row,
      key: index,
    }));

    return (
      <div style={{ marginTop: 16 }}>
        <Title level={5}>
          <FileTextOutlined /> Data Preview ({fileInfo.rowCount} total rows)
        </Title>
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={false}
          scroll={{ x: true }}
          size="small"
          bordered
        />
      </div>
    );
  };

  // Render validation messages
  const renderValidation = () => {
    if (!validationResult) return null;

    return (
      <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
        {validationResult.errors.length > 0 && (
          <Alert
            message="Validation Errors"
            description={
              <ul style={{ margin: 0 }}>
                {validationResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            type="error"
            showIcon
          />
        )}
        {validationResult.warnings.length > 0 && (
          <Alert
            message="Validation Warnings"
            description={
              <ul style={{ margin: 0 }}>
                {validationResult.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
          />
        )}
      </Space>
    );
  };

  return (
    <Card title="📊 Upload Sales Data" size="default">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        {/* File Upload Area */}
        <Dragger {...uploadProps} style={{ padding: '20px' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16 }}>
            Click or drag CSV file to upload
          </p>
          <p className="ant-upload-hint" style={{ color: '#999' }}>
            Support for pizza sales data in CSV format. File should contain date and sales columns.
          </p>
        </Dragger>

        {/* Processing Indicator */}
        {processingFile && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 8 }}>
              <Text>Processing file...</Text>
            </div>
          </div>
        )}

        {/* Validation Results */}
        {renderValidation()}

        {/* Preprocessing Information */}
        {processingInfo?.needsAggregation && processingInfo.preprocessingResult && (
          <Alert
            message="🔄 Data Preprocessing Applied"
            description={
              <div>
                <p>Your dataset contains multiple transactions per day and has been automatically aggregated:</p>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Original: {processingInfo.preprocessingResult.originalRowCount.toLocaleString()} individual transactions</li>
                  <li>Aggregated: {processingInfo.preprocessingResult.aggregatedRowCount} daily totals</li>
                  <li>Date Range: {processingInfo.preprocessingResult.dateRange.start} to {processingInfo.preprocessingResult.dateRange.end}</li>
                </ul>
                <Text type="secondary">This optimization reduces training time from hours to minutes while maintaining forecast accuracy.</Text>
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {/* Configuration Form */}
        {fileInfo && validationResult?.isValid && (
          <>
            <Divider />
            <Title level={5}>⚙️ Configuration</Title>
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onFieldsChange={handleColumnChange}
              disabled={loading}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Date Column"
                    name="dateColumn"
                    rules={[{ required: true, message: 'Please select date column' }]}
                  >
                    <Select placeholder="Select date column">
                      {fileInfo.columns.map(col => (
                        <Option key={col} value={col}>
                          {col}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Value Column"
                    name="valueColumn"
                    rules={[{ required: true, message: 'Please select value column' }]}
                  >
                    <Select placeholder="Select value column to forecast">
                      {fileInfo.columns.map(col => (
                        <Option key={col} value={col}>
                          {col}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Test Split Ratio"
                    name="testSize"
                    rules={[{ required: true, message: 'Please select test size' }]}
                  >
                    <Select>
                      <Option value={0.1}>10% (90% training, 10% testing)</Option>
                      <Option value={0.2}>20% (80% training, 20% testing)</Option>
                      <Option value={0.3}>30% (70% training, 30% testing)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Forecast Horizon"
                    name="forecastHorizon"
                    rules={[{ required: true, message: 'Please select forecast horizon' }]}
                  >
                    <Select>
                      <Option value={7}>7 days</Option>
                      <Option value={14}>14 days</Option>
                      <Option value={30}>30 days</Option>
                      <Option value={60}>60 days</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  block
                >
                  {loading ? 'Training ARIMA Model...' : '🚀 Start Forecasting'}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}

        {/* Data Preview */}
        {renderPreview()}
      </Space>
    </Card>
  );
};

export default CSVUploader;
