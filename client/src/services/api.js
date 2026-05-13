import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "x-api-key": import.meta.env.VITE_INTERNAL_API_KEY || "dev-key",
  },
});

export default api;
