import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import { URL } from "node:url";
import type { Context } from "../shared-types.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { PropertiesValidator } from "./utils.js";

export class Recording
{
  constructor(readonly url: URL, readonly lang: string)
  {}
  static parse(
    _: CheerioAPI,
    context: Context<DictionaryEntity>,
    recording: Cheerio<AnyNode>,
  ): InstanceType<typeof this>
  {
    const validator = new PropertiesValidator<typeof this>(this.name, [
      "url",
      "lang",
    ]);
    validator.required.lang = recording.attr("class")?.split(" ")[0]; // TODO: get a language variant from the url
    validator.required.url = new URL(
      recording.children(".soundOnClick").attr("item-audio-url") ?? "",
      context.request.url,
    );
    const validated = validator.validate();
    return validated as NonNullable<typeof validated>;
  }
}
