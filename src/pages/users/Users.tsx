import { RightOutlined } from "@ant-design/icons";
import { Breadcrumb } from "antd";

import { Link } from "react-router-dom";

export const Users = () => {
  return (
    <>
      <Breadcrumb
        separator={<RightOutlined />}
        items={[
          { title: <Link to={"/"}> Dashboard</Link> },
          { title: "Users" },
        ]}
      />
    </>
  );
};
