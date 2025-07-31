// Auth Service

import type { CreateTenantData, CreateUserData, Credentials } from "../types";
import { api } from "./client";

export const AUTH_SERVICE = "api/auth";
export const CATALOG_SERVICE = "api/catalog";

export const login = (credentials: Credentials) => {
  return api.post(`${AUTH_SERVICE}/auth/login`, credentials);
};

export const self = () => {
  return api.get(`${AUTH_SERVICE}/auth/self`);
};

export const logout = () => {
  return api.post(`${AUTH_SERVICE}/auth/logout`);
};

export const getUsers = (queryString: string) => {
  return api.get(`${AUTH_SERVICE}/users?${queryString}`);
};

export const getTenants = (queryString: string) => {
  return api.get(`${AUTH_SERVICE}/tenants?${queryString}`);
};

export const createUser = (user: CreateUserData) => {
  return api.post(`${AUTH_SERVICE}/users`, user);
};

export const createTenant = (tenant: CreateTenantData) => {
  return api.post(`${AUTH_SERVICE}/tenants`, tenant);
};

// Catalog Service
