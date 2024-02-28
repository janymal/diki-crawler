import type { AnyNode, Cheerio } from "cheerio";
import console from "node:console";
import type { Context } from "../shared-types.js";

export const newDiv = (className: string) => `<div class="${className}"></div>`;

export function logUnknownItem<T>(
  context: Context<T>,
  item: Cheerio<AnyNode>,
  sectionName: string,
)
{
  console.warn(
    `Unknown item in the ${sectionName} section: ${item.prop("outerHTML")}`,
    context.request.url,
  );
}
