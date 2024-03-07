import { Crawler } from "./crawler.js";
import { Page } from "./diki-parser/page.js";

const crawler = new Crawler(
    ["https://www.diki.pl/slownik-angielskiego?q=the"],
    Page,
);

await crawler.crawl();
