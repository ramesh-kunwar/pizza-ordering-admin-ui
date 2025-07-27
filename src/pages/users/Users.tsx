import { PlusOutlined, RightOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumb, Button, Drawer, Form, Space, Table, theme } from "antd";

import { Link, Navigate } from "react-router-dom";
import { getUsers } from "../../http/api";
import type { User } from "../../types";
import { useAuthStore } from "../../store";
import UserFilter from "./UsersFilter";
import { useState } from "react";
import UserForm from "./forms/UserForm";

const columns = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
  },
  {
    title: "Name",
    dataIndex: "firstName",
    key: "firstName",
    render: (_text: string, record: User) => {
      return (
        <div>
          {record.firstName} {record.lastName}
        </div>
      );
    },
  },
  {
    title: "Email",
    dataIndex: "email",
    key: "email",
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
  },
  // {
  //   title: "Restaurant",
  //   dataIndex: "tenant",
  //   key: "tenant",
  //   render: (_text: string, record: User) => {
  //     return <div>{record.tenant?.name}</div>;
  //   },
  // },
];

export const Users = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { user } = useAuthStore();

  const {
    token: { colorBgLayout },
  } = theme.useToken();

  const {
    data: users,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => {
      return getUsers().then((res) => res.data);
    },
  });

  if (user?.role !== "admin") {
    return <Navigate to="/auth/login" replace={true} />;
  }

  return (
    <>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Breadcrumb
          separator={<RightOutlined />}
          items={[{ title: <Link to="/">Dashboard</Link> }, { title: "Users" }]}
        />
        {isLoading && <div>Loading...</div>}
        {isError && <div>{error.message}</div>}

        <UserFilter
          onFilterChange={(filterName: string, filterValue: string) => {
            console.log(filterName, " Filter Name");
            console.log(filterValue, " Filter vaue");
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
          >
            Add User
          </Button>
        </UserFilter>

        <Table columns={columns} dataSource={users} rowKey={"id"} />

        <Drawer
          title="Create user"
          width={720}
          styles={{ body: { backgroundColor: colorBgLayout } }}
          destroyOnClose={true}
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            console.log(drawerOpen);
          }}
          extra={
            <Space>
              <Button>Cancel</Button>
              <Button type="primary">Submit</Button>
            </Space>
          }
        >
          <Form layout="vertical">
            <UserForm />
          </Form>
        </Drawer>
      </Space>
    </>
  );
};
