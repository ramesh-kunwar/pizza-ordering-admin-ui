export type Credentials = {
  email: string;
  password: string;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;

  tenant: Tenant | null;
};

export type Tenant = {
  id: number;
  name: string;
  address: string;
};

export type CreateUserData = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: string;
  tenantId: number;
};

export type FieldData = {
  name: string;
  value?: string;
};

export type CreateTenantData = {
  name: string;
  address: string;
};

export type Category = {
  _id: string;
  name: string;
};

export type Product = {
  _id: string;
  name: string;
  description: string;
  category: Category;
  image: string;
  status: boolean;
  isPublish?: boolean;
  createdAt: string;
};
