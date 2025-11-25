import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ServiceError } from './errors';

export class ServiceClient {
  private client: AxiosInstance;

  constructor(private serviceName: string, private baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async get<T>(path: string, token?: string): Promise<T> {
    try {
      const config: AxiosRequestConfig = {};
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await this.client.get(path, config);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ServiceError(
          error.response?.status || 500,
          this.serviceName,
          error.response?.data?.message || error.message
        );
      }
      throw new ServiceError(500, this.serviceName, 'Unknown error occurred');
    }
  }

  async post<T>(path: string, data: unknown, token?: string): Promise<T> {
    try {
      const config: AxiosRequestConfig = {};
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await this.client.post(path, data, config);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ServiceError(
          error.response?.status || 500,
          this.serviceName,
          error.response?.data?.message || error.message
        );
      }
      throw new ServiceError(500, this.serviceName, 'Unknown error occurred');
    }
  }

  async put<T>(path: string, data: unknown, token?: string): Promise<T> {
    try {
      const config: AxiosRequestConfig = {};
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await this.client.put(path, data, config);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ServiceError(
          error.response?.status || 500,
          this.serviceName,
          error.response?.data?.message || error.message
        );
      }
      throw new ServiceError(500, this.serviceName, 'Unknown error occurred');
    }
  }

  async delete<T>(path: string, token?: string): Promise<T> {
    try {
      const config: AxiosRequestConfig = {};
      if (token) {
        config.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await this.client.delete(path, config);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ServiceError(
          error.response?.status || 500,
          this.serviceName,
          error.response?.data?.message || error.message
        );
      }
      throw new ServiceError(500, this.serviceName, 'Unknown error occurred');
    }
  }
}
