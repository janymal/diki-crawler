import type { AnyNode, Cheerio } from "cheerio";
import console from "node:console";
import type { Context } from "../shared-types.js";

export const newDiv = (className?: string) =>
  `<div${className ? ` class="${className}"` : ""}></div>`;

export function logUnknownItem<T>(
  context: Context<T>,
  item: Cheerio<AnyNode>,
  parserName: string,
)
{
  console.warn(
    `An item having unknown classes "${
      item.attr("class")
    }" found in ${parserName} parser`,
    { url: context.request.url },
  );
}
