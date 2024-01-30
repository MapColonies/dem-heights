import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import config from 'config';

export interface IService {
  url: string;
  exposureType: 'SERVICE' | 'ROUTE';
}

export const requestHandler = async (url: string, method: string, params: AxiosRequestConfig): Promise<AxiosResponse> => {
  const requestConfig: AxiosRequestConfig = {
    url,
    method: method as Method,
    ...params,
    headers: {
      ...{ ...(params.headers ?? {}) },
    } as Record<string, unknown>,
  };

  return axios
    .request(requestConfig)
    .then((res) => res)
    .catch((error) => {
      throw error;
    });
};

export const requestHandlerWithToken = async (url: string, method: string, params: AxiosRequestConfig): Promise<AxiosResponse> => {
  const injectionType = config.get<string>('accessToken.injectionType');
  const attributeName = config.get<string>('accessToken.attributeName');
  const tokenValue = config.get<string>('accessToken.tokenValue');
  const reqConfig = { ...params };

  if (injectionType.toLowerCase() === 'header') {
    reqConfig.headers = {
      ...reqConfig.headers,
      [attributeName]: tokenValue,
    } as Record<string, unknown>;
  } else if (injectionType.toLowerCase() === 'queryparam') {
    reqConfig.params = {
      ...reqConfig.params,
      [attributeName]: tokenValue,
    } as Record<string, unknown>;
  }

  return requestHandler(url, method, reqConfig);
};

export const requestExecutor = async (service: IService, method: string, params: AxiosRequestConfig): Promise<AxiosResponse> => {
  return service.exposureType === 'ROUTE' ? requestHandlerWithToken(service.url, method, params) : requestHandler(service.url, method, params);
};
