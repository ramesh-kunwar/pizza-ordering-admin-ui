import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { getCategories, getTenants } from "../../http/api";
import type { Category, Tenant } from "../../types";

type ProductsFilterProps = {
  children?: React.ReactNode;
};

const ProductsFilter = ({ children }: ProductsFilterProps) => {
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => {
      return getTenants(`perPage=100&currentPage=1`).then((res) => res.data);
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => {
      return getCategories().then((res) => res.data);
    },
  });

  console.log(categories, " categories");
  console.log(restaurants, " restaurants");
  return (
    <Card>
      <Row justify="space-between">
        <Col span={16}>
          <Row gutter={20}>
            <Col span={6}>
              <Form.Item name="q">
                <Input.Search allowClear={true} placeholder="Search" />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item name="category">
                <Select
                  style={{ width: "100%" }}
                  allowClear={true}
                  placeholder="Select category"
                >
                  {/* <Select.Option value="pizza">Pizza</Select.Option>
                  <Select.Option value="beverages">Beverages</Select.Option> */}

                  {categories?.map((category: Category) => (
                    <Select.Option key={category._id} value={category._id}>
                      {category.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item name="restaurant">
                <Select
                  style={{ width: "100%" }}
                  allowClear={true}
                  placeholder="Select restaurant"
                >
                  {/* <Select.Option value="pizza">Pizza hub</Select.Option>
                  <Select.Option value="beverages">Softy corner</Select.Option> */}
                  {restaurants?.data?.map((restaurant: Tenant) => (
                    <Select.Option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={6}>
              <Space>
                <Switch defaultChecked onChange={() => {}} />
                <Typography.Text>Show only published</Typography.Text>
              </Space>
            </Col>
          </Row>
        </Col>
        <Col span={8} style={{ display: "flex", justifyContent: "end" }}>
          {children}
        </Col>
      </Row>
    </Card>
  );
};

export default ProductsFilter;
