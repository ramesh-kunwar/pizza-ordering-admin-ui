import React, { useState, useCallback } from 'react';
import {
  Card,
  Upload,
  Button,
  Table,
  Select,
  Form,
  InputNumber,
  Alert,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Spin,
  message
} from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  RocketOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import type { ColumnsType } from 'antd/es/table';
import { arimaApi } from '../services/arimaApi';
import type { TrainingConfig, TrainingSession } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface CSVUploaderProps {
  onTrainingComplete: (session: TrainingSession) => void;
}

interface FileValidation {
  isValid: boolean;
  columns: string[];
  rowCount: number;
  errors: string[];
}

export const CSVUploader: React.FC<CSVUploaderProps> = ({ onTrainingComplete }) => {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [validation, setValidation] = useState<FileValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);

  // Handle file upload
  const handleFileChange: UploadProps['onChange'] = useCallback(async ({ fileList: newFileList }) => {
    setFileList(newFileList);
    
    if (newFileList.length > 0 && newFileList[0].originFileObj) {
      setLoading(true);
      try {
        const file = newFileList[0].originFileObj as File;
        
        // Validate CSV structure
        const validation = await arimaApi.validateCSV(file);
        setValidation(validation);
        
        if (validation.isValid) {
          // Get preview data
          const preview = await arimaApi.parseCSVPreview(file, 10);
          setCsvPreview(preview);
          
          // Set default form values based on detected columns
          const dateColumn = validation.columns.find(col => 
            /date|time|timestamp/i.test(col)
          ) || validation.columns[0];
          
          const valueColumn = validation.columns.find(col => 
            !col.toLowerCase().includes('date') && 
            !col.toLowerCase().includes('time') &&
            !col.toLowerCase().includes('id')
          ) || validation.columns[1];
          
          form.setFieldsValue({
            dateColumn,
            valueColumn,
            testSize: 0.2,
            forecastHorizon: 30
          });
          
          message.success('CSV file validated successfully!');
        } else {
          setCsvPreview([]);
          message.error('CSV validation failed. Please check the file format.');
        }
      } catch (error: any) {
        console.error('File validation error:', error);
        message.error(`File validation failed: ${error.message}`);
        setValidation({
          isValid: false,
          columns: [],
          rowCount: 0,
          errors: [error.message]
        });
      } finally {
        setLoading(false);
      }
    } else {
      setCsvPreview([]);
      setValidation(null);
    }
  }, [form]);

  // Handle training submission
  const handleTraining = async () => {
    try {
      await form.validateFields();
      
      if (!fileList[0]?.originFileObj) {
        message.error('Please upload a CSV file first');
        return;
      }
      
      setTraining(true);
      const formValues = form.getFieldsValue();
      
      const config: TrainingConfig = {
        dateColumn: formValues.dateColumn,
        valueColumn: formValues.valueColumn,
        testSize: formValues.testSize,
        forecastHorizon: formValues.forecastHorizon,
        autoSelectOrder: true
      };
      
      message.info('Starting ARIMA model training...');
      
      const response = await arimaApi.uploadAndTrain(
        fileList[0].originFileObj as File,
        config
      );
      
      if (response.status === 'success' && response.data) {
        message.success('ARIMA model trained successfully!');
        onTrainingComplete(response.data);
      } else {
        throw new Error(response.message || 'Training failed');
      }
      
    } catch (error: any) {
      console.error('Training error:', error);
      message.error(`Training failed: ${error.message}`);
    } finally {
      setTraining(false);
    }
  };

  // Table columns for CSV preview
  const previewColumns: ColumnsType<any> = csvPreview.length > 0 
    ? Object.keys(csvPreview[0]).map(key => ({
        title: key,
        dataIndex: key,
        key,
        ellipsis: true,
        width: 150,
      }))
    : [];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Upload Section */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>CSV Data Upload</span>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="Upload Time Series Data"
            description="Upload a CSV file containing your time series data. The file should have at least two columns: one for dates/timestamps and one for the values to forecast."
            type="info"
            showIcon
          />
          
          <Upload
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={() => false} // Prevent automatic upload
            accept=".csv"
            maxCount={1}
            onRemove={() => {
              setCsvPreview([]);
              setValidation(null);
            }}
          >
            <Button 
              icon={<UploadOutlined />} 
              size="large"
              loading={loading}
            >
              {loading ? 'Validating...' : 'Select CSV File'}
            </Button>
          </Upload>
          
          {validation && (
            <Alert
              message={validation.isValid ? 'File Validation Passed' : 'File Validation Failed'}
              description={
                validation.isValid 
                  ? `Found ${validation.columns.length} columns and ${validation.rowCount} rows`
                  : validation.errors.join(', ')
              }
              type={validation.isValid ? 'success' : 'error'}
              showIcon
            />
          )}
        </Space>
      </Card>

      {/* Configuration Section */}
      {validation?.isValid && csvPreview.length > 0 && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined />
              <span>Training Configuration</span>
            </Space>
          }
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              testSize: 0.2,
              forecastHorizon: 30
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Date Column"
                  name="dateColumn"
                  rules={[{ required: true, message: 'Please select the date column' }]}
                  tooltip="Column containing the date/timestamp data"
                >
                  <Select placeholder="Select date column">
                    {validation.columns.map(col => (
                      <Option key={col} value={col}>{col}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  label="Value Column"
                  name="valueColumn"
                  rules={[{ required: true, message: 'Please select the value column' }]}
                  tooltip="Column containing the numeric values to forecast"
                >
                  <Select placeholder="Select value column">
                    {validation.columns.map(col => (
                      <Option key={col} value={col}>{col}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Test Size"
                  name="testSize"
                  rules={[
                    { required: true, message: 'Test size is required' },
                    { type: 'number', min: 0.1, max: 0.5, message: 'Test size must be between 0.1 and 0.5' }
                  ]}
                  tooltip="Fraction of data to use for testing (0.1 = 10%, 0.2 = 20%)"
                >
                  <InputNumber
                    min={0.1}
                    max={0.5}
                    step={0.1}
                    style={{ width: '100%' }}
                    formatter={value => `${(Number(value) * 100).toFixed(0)}%`}
                    parser={value => Number(value!.replace('%', '')) / 100}
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  label="Forecast Horizon"
                  name="forecastHorizon"
                  rules={[
                    { required: true, message: 'Forecast horizon is required' },
                    { type: 'number', min: 1, max: 365, message: 'Forecast horizon must be between 1 and 365' }
                  ]}
                  tooltip="Number of future periods to forecast"
                >
                  <InputNumber
                    min={1}
                    max={365}
                    style={{ width: '100%' }}
                    addonAfter="periods"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>
      )}

      {/* Data Preview Section */}
      {csvPreview.length > 0 && (
        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>Data Preview</span>
              <Text type="secondary">({csvPreview.length} rows shown)</Text>
            </Space>
          }
        >
          <Table
            columns={previewColumns}
            dataSource={csvPreview}
            pagination={false}
            scroll={{ x: true, y: 300 }}
            size="small"
            rowKey={(record, index) => index?.toString() || '0'}
          />
        </Card>
      )}

      {/* Training Button */}
      {validation?.isValid && (
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
            <Title level={4}>Ready to Train ARIMA Model</Title>
            <Paragraph type="secondary">
              Click the button below to start training your ARIMA forecasting model. 
              This process may take a few minutes depending on your data size.
            </Paragraph>
            
            <Button
              type="primary"
              size="large"
              icon={training ? <Spin /> : <RocketOutlined />}
              onClick={handleTraining}
              loading={training}
              style={{ minWidth: 200 }}
            >
              {training ? 'Training Model...' : 'Start ARIMA Training'}
            </Button>
            
            {training && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Training in progress... This may take 2-5 minutes
              </Text>
            )}
          </Space>
        </Card>
      )}
    </Space>
  );
};
