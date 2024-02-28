import type { InternalAxiosRequestConfig } from "axios";
import type { Crawler } from "./crawler.js";

export interface Context<T>
{
  request: InternalAxiosRequestConfig;
  crawler: Crawler<T>;
}

export interface ParsedRequest<T>
{
  request: InternalAxiosRequestConfig;
  items: T[];
}

export type ParsingFunction<T> = (
  page: string,
  context: Context<T>,
) => Generator<T, void>;
