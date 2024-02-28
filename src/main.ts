import { Crawler } from "./crawler.js";
import { DikiItem } from "./parser/diki-item.js";

const crawler = new Crawler(
  ["https://www.diki.pl/slownik-angielskiego?q=the"],
  DikiItem,
);

await crawler.crawl();
