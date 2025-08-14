import { PlusOutlined } from "@ant-design/icons";
import { Form, Space, Typography, Upload, type UploadProps } from "antd";
import { useState } from "react";

const ProductImage = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const uploaderconfig: UploadProps = {
    name: "file",
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      setImageUrl(URL.createObjectURL(file));
      return false;
    },
  };
  return (
    <div>
      <Form.Item
        label=""
        name="image"
        rules={[
          {
            required: true,
            message: "Please upload a product image",
          },
        ]}
      >
        <Upload listType="picture-card" {...uploaderconfig}>
          {imageUrl ? (
            <img src={imageUrl} alt="avatar" style={{ width: "100%" }} />
          ) : (
            <Space direction="vertical">
              <PlusOutlined />
              <Typography.Text>Upload</Typography.Text>
            </Space>
          )}
          {/* <Space direction="vertical">
                      <PlusOutlined />
                      <Typography.Text>Upload</Typography.Text>
                    </Space> */}
        </Upload>
      </Form.Item>
    </div>
  );
};

export default ProductImage;
