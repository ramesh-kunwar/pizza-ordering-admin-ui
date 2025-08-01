import { createBrowserRouter } from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/login/login";
import Dashboard from "./layouts/Dashboard";
import NonAuth from "./layouts/NonAuth";
import Root from "./layouts/Root";
import { Users } from "./pages/users/Users";
import Tenants from "./pages/tenants/Tenants";
import Products from "./pages/products/Products";
import Forecasting from "./pages/Forecasting";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        path: "",
        element: <Dashboard />,
        children: [
          {
            path: "",
            element: <HomePage />,
          },

          {
            path: "/users",
            element: <Users />,
          },
          {
            path: "/restaurants",
            element: <Tenants />,
          },

          {
            path: "/products",
            element: <Products />,
          },
          {
            path: "/forecasting",
            element: <Forecasting />,
          },
        ],
      },
      {
        path: "/auth",
        element: <NonAuth />,
        children: [
          {
            path: "/auth/login",
            element: <LoginPage />,
          },
        ],
      },
    ],
  },
]);
