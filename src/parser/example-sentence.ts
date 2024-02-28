import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import type { Context } from "../shared-types.js";
import { PropertiesValidator } from "../validator.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import {
  RecordingsAndTranscriptions,
} from "./recordings-and-transcriptions.js";
import { logUnknownItem } from "./utils.js";

export class ExampleSentence
{
  constructor(
    readonly sentence: string,
    readonly translation: string,
    readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
  )
  {}
  static parse(
    $: CheerioAPI,
    context: Context<DictionaryEntity>,
    exampleSentence: Cheerio<AnyNode>,
  ): InstanceType<typeof this>
  {
    const validator = new PropertiesValidator<typeof this>(this.name, [
      "translation",
    ], ["recordingsAndTranscriptions"]);
    exampleSentence.contents().each((_, childNode) =>
    {
      const child = $(childNode);
      if (childNode.nodeType === 3)
      {
        validator.required.sentence = (validator.required.sentence ?? "") +
          child.text();
      } else if (child.hasClass("exampleSentenceTranslation"))
        validator.required.translation = child.text().trim().slice(1, -1);
      else if (child.hasClass("recordingsAndTranscriptions"))
      {
        validator.optional.recordingsAndTranscriptions =
          RecordingsAndTranscriptions.parse(
            $,
            context,
            exampleSentence.children(".recordingsAndTranscriptions"),
          );
      } else if (child.hasClass("repetitionAddOrRemoveIconAnchor"))
        return;
      else
        logUnknownItem(context, child, ExampleSentence.name);
    });
    validator.required.sentence = validator.required.sentence?.trim();
    const validated = validator.validate();
    return validated as NonNullable<typeof validated>;
  }
}
