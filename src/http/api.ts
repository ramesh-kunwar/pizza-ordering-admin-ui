// Auth Service

import type { Credentials } from "../types";
import { api } from "./client";

export const login = (credentials: Credentials) => {
  return api.post("/auth/login", credentials);
};

export const self = () => {
  return api.get("/auth/self");
};

export const logout = () => {
  return api.post("/auth/logout");
};

export const getUsers = () => {
  return api.get("/users");
};
