import console from "node:console";
import fs from "node:fs";
import type { AxiosError, AxiosInstance, AxiosProxyConfig } from "axios";
import axios from "axios";
import { shuffle } from "lodash-es";

function testProxy(
    instance: AxiosInstance,
    proxyConfig: AxiosProxyConfig,
    file?: number,
): Promise<void> {
    const proxyUrl = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
    return instance
        .get("https://www.diki.pl/slownik-angielskiego?q=the", {
            proxy: proxyConfig,
            timeout: 7 * 1000,
        })
        .then(
            () => {
                console.log(`${proxyUrl}: ok`);
                if (file !== undefined)
                    fs.writeSync(file, `\t${JSON.stringify(proxyConfig)},\n`);
            },
            (error: AxiosError | Error) => {
                console.log(`${proxyUrl}: fail`);
                console.error(`${error.name}: ${error.message}`);
            },
        );
}

async function main(jobs = 10) {
    const instance = axios.create();
    const outputFile = fs.openSync("proxies.json", "w");
    fs.writeSync(outputFile, "[\n");
    const response = await instance
        .get<string>(
            "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
        )
        .then((r) => r.data);
    // console.debug(response);
    const proxies: AxiosProxyConfig[] = shuffle(
        response.split("\n").flatMap<AxiosProxyConfig>((url) => {
            const splitted = url.split(":");
            const host = splitted[0];
            const port = Number.parseInt(splitted[1]);
            return ["http", "https"].map<AxiosProxyConfig>((protocol) => {
                return { host: host, port: port, protocol: protocol };
            });
        }),
    );
    // console.debug(proxies);
    for (let batchStart = 0; batchStart < proxies.length; batchStart += jobs) {
        const batchLength =
            batchStart + jobs < proxies.length
                ? jobs
                : proxies.length - batchStart;
        const tasks: Promise<void>[] = [];
        for (
            let taskIndex = batchStart;
            taskIndex < batchStart + batchLength;
            taskIndex++
        ) {
            tasks.push(testProxy(instance, proxies[taskIndex], outputFile));
        }
        await Promise.all(tasks);
    }
    const fileStats = fs.fstatSync(outputFile);
    if (fileStats.size > 2) fs.writeSync(outputFile, "\n]", fileStats.size - 2);
    else fs.writeSync(outputFile, "]");
    fs.closeSync(outputFile);
}

await main(200);
