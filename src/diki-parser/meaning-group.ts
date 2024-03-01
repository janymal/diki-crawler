import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { PropertiesValidator } from "../validator.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { Form } from "./form.js";
import { Meaning } from "./meaning.js";
import { logUnknownItem, newDiv } from "./utils.js";

export class MeaningGroup
{
  constructor(
    readonly meanings: Meaning[],
    readonly irregularForms?: Form[],
    readonly partOfSpeech?: string,
  )
  {}
  static parse(
    $: CheerioAPI,
    context: Context<DictionaryEntity>,
    meaningGroup: Cheerio<AnyNode>,
  ): MeaningGroup
  {
    const validator = new PropertiesValidator<MeaningGroup>(this.name, [
      "meanings",
    ], ["irregularForms", "partOfSpeech"]);
    meaningGroup.children().each((_, childElement) =>
    {
      const child = $(childElement);
      if (child.hasClass("partOfSpeechSectionHeader"))
      {
        validator.optional.partOfSpeech = child
          .children(".partOfSpeech")
          .text();
      } else if (child.hasClass("foreignToNativeMeanings"))
      {
        validator.required.meanings = child
          .children("li")
          .map((_, meaningElement) =>
            Meaning.parse($, context, $(meaningElement))
          )
          .get();
      } else if (child.hasClass("vf"))
      {
        validator.optional.irregularForms = child
          .children(".foreignTermText")
          .map((_, foreignTermTextElement) =>
          {
            const form = $(foreignTermTextElement)
              .nextUntil(".foreignTermText")
              .addBack()
              .wrapAll(newDiv("form"))
              .parent();
            return Form.parse($, context, form);
          })
          .get();
      } else if (child.hasClass("additionalSentences"))
        return;
      else
        logUnknownItem(context, child, this.name);
    });
    return validator.validate();
  }
}
