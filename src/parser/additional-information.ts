import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { logUnknownItem, PropertiesValidator } from "./utils.js";

export class AdditionalInformation
{
  constructor(
    readonly languageRegister?: string[],
    readonly languageVariety?: string,
    readonly other?: string[],
    readonly popularity?: number,
  )
  {}
  static parse(
    $: CheerioAPI,
    context: Context<DictionaryEntity>,
    additionalInformation: Cheerio<AnyNode>,
  ): InstanceType<typeof this> | undefined
  {
    const validator = new PropertiesValidator<typeof this>(this.name, [], [
      "languageVariety",
      "popularity",
    ]);
    additionalInformation.contents().each((_, childNode) =>
    {
      const child = $(childNode);
      if (child.hasClass("starsForNumOccurrences"))
        validator.optional.popularity = child.text().length;
      else if (child.hasClass("languageVariety"))
        validator.optional.languageVariety = child.text();
      else if (child.hasClass("languageRegister"))
      {
        validator.optional.languageRegister = [
          ...(validator.optional.languageRegister ?? []),
          child.text(),
        ];
      } else if (childNode.nodeType === 3)
      {
        const nodeText = child.text().trim().slice(1, -1) || undefined;
        if (nodeText)
        {
          validator.optional.other = [
            ...validator.optional.other ?? [],
            nodeText,
          ];
        }
      } else
      {
        logUnknownItem(context, child, this.name);
      }
    });

    const validated = validator.validate();
    return validated;
  }
}
