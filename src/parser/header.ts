import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { AdditionalInformation } from "./additional-information.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import {
  RecordingsAndTranscriptions,
} from "./recordings-and-transcriptions.js";
import { logUnknownItem, PropertiesValidator } from "./utils.js";

export class Header
{
  constructor(
    readonly title: string,
    readonly lessPopular: boolean,
    readonly additionalInformation?: AdditionalInformation,
    readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
  )
  {}
  static parse(
    $: CheerioAPI,
    context: Context<DictionaryEntity>,
    header: Cheerio<AnyNode>,
  ): InstanceType<typeof this>
  {
    const validator = new PropertiesValidator<typeof this>(this.name, [
      "title",
      "lessPopular",
    ], ["additionalInformation", "recordingsAndTranscriptions"]);
    header.children().each((_, childElement) =>
    {
      const child = $(childElement);
      if (child.hasClass("hw"))
      {
        validator.required.title = child.text().trim();
        validator.required.lessPopular = child.hasClass(
          "hwLessPopularAlternative",
        );
      } else if (child.hasClass("recordingsAndTranscriptions"))
      {
        validator.optional.recordingsAndTranscriptions =
          RecordingsAndTranscriptions.parse($, context, child);
      } else if (child.hasClass("dictionaryEntryHeaderAdditionalInformation"))
      {
        validator.optional.additionalInformation = AdditionalInformation.parse(
          $,
          context,
          child,
        );
      } else if (child.prop("tagName") === "BR")
        return;
      else
        logUnknownItem(context, child, Header.name);
    });

    const validated = validator.validate();
    return validated as NonNullable<typeof validated>;
  }
}
