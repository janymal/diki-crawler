import type { AxiosInstance } from "axios";
import axios from "axios";
import console from "node:console";
import fs from "node:fs";
import type { ParsedRequest, ParsingFunction } from "./shared-types.js";
import { ensureDir, md5Hash } from "./utils.js";

export class Crawler<T> {
    private axiosInstance: AxiosInstance;
    private tasks: Promise<unknown>[];
    constructor(
        private entryUrls: string[],
        private parser: ParsingFunction<T>,
        private outputDir = "data",
        // private maxRetries: number = 3,
        // private maxRequestsPerMinute: number = 10,
    ) {
        this.axiosInstance = axios.create();
        this.tasks = this.entryUrls.map((url) => this.urlPipeline(url));
    }
    async crawl(): Promise<void> {
        ensureDir(this.outputDir);
        while (this.tasks.length > 0) await this.tasks.pop();
    }
    addUrl(url: string) {
        this.tasks.push(this.urlPipeline(url));
    }

    private async resolveUrl(url: string): Promise<ParsedRequest<T>> {
        const response = await this.axiosInstance.get<string>(url);
        const items: T[] = [
            ...this.parser(response.data, {
                request: response.config,
                crawler: this,
            }),
        ];
        return { request: response.config, items: items };
    }

    private writeRequestResult({
        request,
        items: responseData,
    }: ParsedRequest<T>) {
        if (request.url === undefined) throw new Error("request url is empty");
        const fileName = md5Hash(request.url);
        const fileContent = JSON.stringify(responseData, undefined, 4);
        fs.writeFileSync(`${this.outputDir}/${fileName}.json`, fileContent);
    }
    private async urlPipeline(url: string) {
        console.log(`[INFO] Parsing ${url}...`);
        const resolved = await this.resolveUrl(url);
        this.writeRequestResult(resolved);
        console.log(`[INFO] Done with ${url}!`);
    }
}

// TODO: url enqueuing and filtering

// await context.enqueueLinks({
//   globs: ["http?(s)://www.diki.pl/slownik-angielskiego?q=*"],
//   label: "detail",
// });
