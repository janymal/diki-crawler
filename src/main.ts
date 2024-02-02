import { CheerioCrawler, purgeDefaultStorages } from "crawlee";
import { router } from "./routes.js";

const sources = [
  {
    url: "https://www.diki.pl/slownik-angielskiego?q=the",
    userData: {
      label: "detail",
    },
  },
];

const crawler = new CheerioCrawler({
  requestHandler: router,
  maxRequestsPerCrawl: 20,
});

await purgeDefaultStorages();
await crawler.run(sources);
