import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  Card, 
  Typography, 
  Button, 
  Select, 
  Form, 
  Row, 
  Col, 
  Progress, 
  Alert, 
  Table, 
  Space, 
  Checkbox, 
  Divider,
  message 
} from 'antd';
import { 
  InboxOutlined, 
  SettingOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined,
  LoadingOutlined 
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { DataProcessor } from '../lib/data-processor';
import type { FileUploadState, ProcessedDataset } from '../types/forecasting';
// import { FileUploadState, ProcessedDataset } from '../types/forecasting';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface DataUploaderProps {
  onDataUploaded: (dataset: ProcessedDataset) => void;
  uploadState: FileUploadState;
  onUploadStateChange: (state: Partial<FileUploadState>) => void;
}

interface ProcessingOptions {
  dateField: string;
  timeField?: string;
  valueField: string;
  aggregationType: 'sum' | 'mean' | 'count';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  forecastType: 'single' | 'multiple';
  additionalFields?: string[];
}

export const DataUploader: React.FC<DataUploaderProps> = ({ 
  onDataUploaded, 
  uploadState, 
  onUploadStateChange 
}) => {
  const [form] = Form.useForm();
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    dateField: 'order_date',
    timeField: 'order_time',
    valueField: 'total_price',
    aggregationType: 'sum',
    frequency: 'daily',
    forecastType: 'multiple',
    additionalFields: ['quantity']
  });
  
  const [showOptions, setShowOptions] = useState(false);
  const [rawData, setRawData] = useState<any[] | null>(null);
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,.json',
    beforeUpload: (file) => {
      handleFileUpload(file);
      return false; // Prevent automatic upload
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const handleFileUpload = useCallback(async (file: File) => {
    onUploadStateChange({ 
      file, 
      isUploading: true, 
      progress: 0, 
      error: null,
      preview: []
    });

    try {
      onUploadStateChange({ progress: 25 });
      
      const data = await DataProcessor.parseCSV(file);
      
      onUploadStateChange({ progress: 50 });
      
      const validation = DataProcessor.validateDataset(data);
      
      if (!validation.isValid) {
        throw new Error(validation.errors.join('. ') + 
          (validation.suggestions.length > 0 ? ' Suggestions: ' + validation.suggestions.join('. ') : ''));
      }

      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      setAvailableFields(headers);
      setRawData(data);
      
      const preview = data.slice(0, 5);
      onUploadStateChange({ 
        progress: 75,
        preview
      });

      const guessedOptions = guessProcessingOptions(headers, data.slice(0, 10));
      setProcessingOptions(guessedOptions);
      form.setFieldsValue(guessedOptions);
      
      onUploadStateChange({ 
        progress: 100,
        isUploading: false
      });

      setShowOptions(true);
      message.success('File uploaded successfully!');

    } catch (error) {
      console.error('Upload error:', error);
      onUploadStateChange({ 
        error: error instanceof Error ? error.message : 'Upload failed',
        isUploading: false,
        progress: 0
      });
      message.error('Upload failed. Please check your file format.');
    }
  }, [onUploadStateChange, form]);

  const guessProcessingOptions = (headers: string[], sampleData: any[]): ProcessingOptions => {
    const dateFields = headers.filter(h => 
      h.toLowerCase().includes('date') || 
      h.toLowerCase().includes('timestamp')
    );
    
    const timeFields = headers.filter(h => 
      h.toLowerCase().includes('time') && 
      !h.toLowerCase().includes('date')
    );
    
    const numericFields = headers.filter(h => {
      const sample = sampleData.map(row => row[h]).filter(v => v != null);
      return sample.length > 0 && sample.every(v => !isNaN(Number(v)));
    });

    const priceField = numericFields.find(h => 
      h.toLowerCase().includes('price') || 
      h.toLowerCase().includes('total') ||
      h.toLowerCase().includes('amount') ||
      h.toLowerCase().includes('revenue')
    );

    const quantityField = numericFields.find(h => 
      h.toLowerCase().includes('quantity') || 
      h.toLowerCase().includes('qty') ||
      h.toLowerCase().includes('count') ||
      h.toLowerCase().includes('units')
    );

    const valueField = priceField || numericFields[0] || headers[0];
    const additionalFields = [];
    
    if (quantityField && quantityField !== valueField) {
      additionalFields.push(quantityField);
    }

    return {
      dateField: dateFields[0] || headers[0],
      timeField: timeFields[0],
      valueField,
      aggregationType: 'sum',
      frequency: 'daily',
      forecastType: additionalFields.length > 0 ? 'multiple' : 'single',
      additionalFields
    };
  };

  const processData = async () => {
    if (!rawData) return;

    onUploadStateChange({ isUploading: true, progress: 0 });

    try {
      const values = await form.validateFields();
      const options = { ...processingOptions, ...values };
      
      onUploadStateChange({ progress: 25 });

      const dataset = DataProcessor.processTimeSeriesData(rawData, options);
      
      onUploadStateChange({ progress: 75 });

      if (dataset.timeSeries.length < 10) {
        throw new Error('Insufficient data points for forecasting (minimum 10 required)');
      }

      onUploadStateChange({ progress: 100, isUploading: false });
      onDataUploaded(dataset);
      setShowOptions(false);
      message.success('Data processed successfully!');

    } catch (error) {
      console.error('Processing error:', error);
      onUploadStateChange({ 
        error: error instanceof Error ? error.message : 'Processing failed',
        isUploading: false,
        progress: 0
      });
      message.error('Data processing failed. Please check your configuration.');
    }
  };

  const resetUpload = () => {
    setRawData(null);
    setAvailableFields([]);
    setShowOptions(false);
    form.resetFields();
    onUploadStateChange({
      file: null,
      isUploading: false,
      progress: 0,
      error: null,
      preview: []
    });
  };

  const previewColumns = uploadState.preview.length > 0 
    ? Object.keys(uploadState.preview[0]).slice(0, 6).map(key => ({
        title: key,
        dataIndex: key,
        key,
        ellipsis: true,
        width: 150,
        render: (value: any) => String(value)
      }))
    : [];

  if (showOptions && rawData) {
    return (
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>Data Processing Configuration</span>
          </Space>
        }
        extra={
          <Button type="link" onClick={resetUpload}>
            Upload Different File
          </Button>
        }
      >
        <Form 
          form={form} 
          layout="vertical"
          initialValues={processingOptions}
          onValuesChange={(_, allValues) => setProcessingOptions(allValues)}
        >
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Form.Item
                label="Date Field"
                name="dateField"
                rules={[{ required: true, message: 'Please select a date field' }]}
              >
                <Select placeholder="Select date field">
                  {availableFields.map(field => (
                    <Select.Option key={field} value={field}>{field}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Time Field (Optional)"
                name="timeField"
              >
                <Select placeholder="Select time field" allowClear>
                  {availableFields.map(field => (
                    <Select.Option key={field} value={field}>{field}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Value Field"
                name="valueField"
                rules={[{ required: true, message: 'Please select a value field' }]}
              >
                <Select placeholder="Select value field">
                  {availableFields.map(field => (
                    <Select.Option key={field} value={field}>{field}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
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

            <Col span={8}>
              <Form.Item
                label="Time Frequency"
                name="frequency"
              >
                <Select>
                  <Select.Option value="hourly">Hourly</Select.Option>
                  <Select.Option value="daily">Daily</Select.Option>
                  <Select.Option value="weekly">Weekly</Select.Option>
                  <Select.Option value="monthly">Monthly</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label="Forecast Type"
                name="forecastType"
              >
                <Select>
                  <Select.Option value="single">Single Variable</Select.Option>
                  <Select.Option value="multiple">Multiple Variables</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {processingOptions.forecastType === 'multiple' && (
            <Form.Item
              label="Additional Variables to Forecast"
              name="additionalFields"
            >
              <Checkbox.Group>
                <Row>
                  {availableFields
                    .filter(field => 
                      field !== processingOptions.dateField && 
                      field !== processingOptions.timeField &&
                      field !== processingOptions.valueField
                    )
                    .map(field => (
                      <Col span={8} key={field}>
                        <Checkbox value={field}>{field}</Checkbox>
                      </Col>
                    ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>

        {uploadState.preview && uploadState.preview.length > 0 && (
          <>
            <Divider>Data Preview</Divider>
            <Table
              columns={previewColumns}
              dataSource={uploadState.preview.slice(0, 3)}
              pagination={false}
              size="small"
              scroll={{ x: true }}
              rowKey={(_, index) => index?.toString() || '0'}
            />
          </>
        )}

        <Divider />

        <Row gutter={16}>
          <Col flex="auto">
            <Button
              type="primary"
              size="large"
              onClick={processData}
              loading={uploadState.isUploading}
              icon={uploadState.isUploading ? <LoadingOutlined /> : <CheckCircleOutlined />}
              block
            >
              {uploadState.isUploading 
                ? `Processing... ${uploadState.progress}%` 
                : 'Process Data'
              }
            </Button>
          </Col>
          <Col>
            <Button 
              size="large" 
              onClick={() => setShowOptions(false)}
            >
              Cancel
            </Button>
          </Col>
        </Row>

        {uploadState.isUploading && (
          <Progress 
            percent={uploadState.progress} 
            style={{ marginTop: 16 }}
            strokeColor="#F65f42"
          />
        )}
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>Upload Time Series Data</span>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Paragraph>
          Upload a CSV or JSON file with time series data for forecasting. 
          Ensure your file contains date/time and numeric value columns.
        </Paragraph>
      </div>

      <Dragger 
        {...uploadProps}
        style={{ 
          background: uploadState.isUploading ? '#f5f5f5' : undefined,
          pointerEvents: uploadState.isUploading ? 'none' : 'auto'
        }}
      >
        <p className="ant-upload-drag-icon">
          {uploadState.isUploading ? (
            <LoadingOutlined style={{ fontSize: 48, color: '#F65f42' }} />
          ) : (
            <InboxOutlined style={{ fontSize: 48, color: '#F65f42' }} />
          )}
        </p>
        
        <p className="ant-upload-text">
          {uploadState.isUploading ? (
            <Space direction="vertical">
              <Text strong>Processing file... {uploadState.progress}%</Text>
              {uploadState.file && (
                <Text type="secondary">
                  {uploadState.file.name} ({(uploadState.file.size / 1024).toFixed(1)} KB)
                </Text>
              )}
            </Space>
          ) : (
            <Text strong>Click or drag file to this area to upload</Text>
          )}
        </p>
        
        {!uploadState.isUploading && (
          <p className="ant-upload-hint">
            Supports CSV and JSON files up to 50MB. 
            Ensure your file has headers and contains date/time columns.
          </p>
        )}
      </Dragger>

      {uploadState.isUploading && (
        <Progress 
          percent={uploadState.progress} 
          style={{ marginTop: 16 }}
          strokeColor="#F65f42"
        />
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

      <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
        <Text type="secondary">
          <strong>Supported formats:</strong> CSV files with headers, JSON arrays of objects<br />
          <strong>Required columns:</strong> At least one date/time column and one numeric value column
        </Text>
      </div>
    </Card>
  );
};
