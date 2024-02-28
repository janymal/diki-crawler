import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import { URL } from "node:url";
import type { Context } from "../shared-types.js";
import { Header } from "./header.js";
import { MeaningGroup } from "./meaning-group.js";
import { logUnknownItem, newDiv, PropertiesValidator } from "./utils.js";

export class DictionaryEntity
{
  constructor(
    readonly headers: Header[],
    readonly meaningGroups: MeaningGroup[],
    readonly note?: string,
    readonly pictures?: URL[],
  )
  {}
  static parse(
    $: CheerioAPI,
    context: Context<InstanceType<typeof this>>,
    dictionaryEntity: Cheerio<AnyNode>,
  ): InstanceType<typeof this>
  {
    const validator = new PropertiesValidator<typeof this>(this.name, [
      "headers",
      "meaningGroups",
    ], ["note"]);
    let secondSectionStartIndex: number | undefined;
    const dictionaryEntityChildren = dictionaryEntity.children();
    dictionaryEntityChildren.each((i, childElement) =>
    {
      const child = $(childElement);
      if (
        child.hasClass("partOfSpeechSectionHeader") ||
        child.hasClass("foreignToNativeMeanings")
      )
      {
        secondSectionStartIndex = i;
        return false;
      } else if (child.hasClass("hws"))
      {
        validator.required.headers = child
          .children("h1")
          .children(".hw")
          .map((_, hwElement) =>
          {
            const header = $(hwElement)
              .nextUntil(".hw, .hwcomma")
              .addBack()
              .wrapAll(newDiv("header"))
              .parent();
            return Header.parse($, context, header);
          })
          .get();
        validator.optional.note = child.children(".nt").text() || undefined;
      } else if (child.hasClass("dictpict"))
      {
        validator.optional.pictures = [
          ...validator.optional.pictures ?? [],
          new URL(child.children("img").attr("src") ?? "", context.request.url),
        ];
      } else
      {
        logUnknownItem(context, child, DictionaryEntity.name);
      }
      return true;
    });
    validator.required.meaningGroups = dictionaryEntityChildren
      .slice(secondSectionStartIndex)
      .filter(".foreignToNativeMeanings")
      .map((_, foreignToNativeMeaningsElement) =>
      {
        const meaningGroup = $(foreignToNativeMeaningsElement)
          .prev(".partOfSpeechSectionHeader")
          .addBack()
          .nextUntil(".foreignToNativeMeanings, .partOfSpeechSectionHeader")
          .addBack()
          .wrapAll(newDiv("meaningGroup"))
          .parent();
        return MeaningGroup.parse($, context, meaningGroup);
      })
      .get();
    const validated = validator.validate();
    return validated as NonNullable<typeof validated>;
  }
}
