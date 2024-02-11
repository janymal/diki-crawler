import type { AnyNode, Cheerio } from "cheerio" with {
  "resolution-mode": "require",
};
import { type CheerioCrawlingContext, createCheerioRouter } from "crawlee";
import { URL } from "node:url";

export const router = createCheerioRouter();

const removeBrackets = (str: string) => str.slice(1, -1);

type Mutable<T> = { -readonly [key in keyof T]: T[key] };

class Recording
{
  constructor(readonly url: URL, readonly lang: string)
  {}

  static parse(
    context: CheerioCrawlingContext,
    recording: Cheerio<AnyNode>,
  ): Recording
  {
    const data: Partial<Mutable<Recording>> = {};
    data.lang = recording.attr("class")?.split(" ")[0];
    const audioUrl = recording.children(".soundOnClick").attr("data-audio-url");

    if (typeof data.lang !== "string")
    {
      throw new TypeError(
        `Recording.parse(): data.lang is not a string [${data.lang}]`,
      );
    }
    if (typeof audioUrl !== "string")
    {
      throw new TypeError(
        `Recording.parse(): audioUrl is not a string [${audioUrl}]`,
      );
    }

    data.url = new URL(audioUrl, context.request.url);
    return new this(data.url, data.lang);
  }
}

class RecordingsAndTranscriptions
{
  constructor(
    readonly recordings?: Recording[],
    readonly transcriptions?: string[],
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    recordingsAndTranscriptions: Cheerio<AnyNode>,
  ): RecordingsAndTranscriptions
  {
    const data: Partial<Mutable<RecordingsAndTranscriptions>> = {};
    recordingsAndTranscriptions.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("hasRecording"))
      {
        data.recordings = [
          ...data.recordings ?? [],
          Recording.parse(context, child),
        ];
      } else if (child.hasClass("phoneticTranscription"))
      {
        const url = child.children("a").children("img").attr("src");
        if (typeof url !== "string")
        {
          throw new TypeError(
            `RecordingsAndTranscriptions.parse(): url is not a string [${url}]`,
          );
        }
        data.transcriptions = [...data.transcriptions ?? [], url];
      }
    });
    return new this(data.recordings, data.transcriptions);
  }
}

class AdditionalInformation
{
  constructor(
    readonly languageRegister?: string[],
    readonly languageVariety?: string,
    readonly other?: string[],
    readonly popularity?: number,
  )
  {}
  static parse(
    context: CheerioCrawlingContext,
    additionalInformation: Cheerio<AnyNode>,
  ): AdditionalInformation
  {
    const data: Mutable<Partial<AdditionalInformation>> = {};
    additionalInformation.contents().each((_, childNode) =>
    {
      const child = context.$(childNode);
      if (child.hasClass("starsForNumOccurrences"))
        data.popularity = child.text().length;
      else if (child.hasClass("languageVariety"))
        data.languageVariety = child.text();
      else if (child.hasClass("languageRegister"))
      {
        data.languageRegister = [
          ...(data.languageRegister ?? []),
          child.text(),
        ];
      } else if (childNode.nodeType === 3)
      {
        const nodeText = removeBrackets(child.text().trim()) || undefined;
        if (nodeText)
          data.other = [...data.other ?? [], nodeText];
      } else
      {
        context.log.warning(
          `Unknown field in the Additional Information section: ${child.html()}`,
        );
      }
    });
    return new this(
      data.languageRegister,
      data.languageVariety,
      data.other,
      data.popularity,
    );
  }
}

class ExampleSentence
{
  constructor(
    readonly sentence: string,
    readonly translation: string,
    readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
  )
  {}
  static parse(
    context: CheerioCrawlingContext,
    exampleSentence: Cheerio<AnyNode>,
  ): ExampleSentence
  {
    const data: Partial<Mutable<ExampleSentence>> = {};
    exampleSentence.contents().each((_, childNode) =>
    {
      const child = context.$(childNode);
      if (childNode.nodeType === 3)
        data.sentence = (data.sentence ?? "").concat(child.text());
      else if (child.hasClass("exampleSentenceTranslation"))
        data.translation = removeBrackets(child.text().trim());
      else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = RecordingsAndTranscriptions.parse(
          context,
          exampleSentence.children(".recordingsAndTranscriptions"),
        );
      }
    });
    if (typeof data.sentence !== "string")
    {
      throw new TypeError(
        `ExampleSentence.parse(): data.sentence is not a string [${data.sentence}]`,
      );
    }
    if (typeof data.translation !== "string")
    {
      throw new TypeError(
        `ExampleSentence.parse(): data.translation is not a string [${data.translation}]`,
      );
    }
    data.sentence = data.sentence.trim();
    return new this(
      data.sentence,
      data.translation,
      data.recordingsAndTranscriptions,
    );
  }
}

class RefItem
{
  constructor(
    readonly word: string,
    readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
  )
  {}
  static parse(
    context: CheerioCrawlingContext,
    refItem: Cheerio<AnyNode>,
  ): RefItem
  {
    const data: Partial<Mutable<RefItem>> = {};
    refItem.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.prop("tagName") === "A")
        data.word = child.text();
      else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = RecordingsAndTranscriptions.parse(
          context,
          child,
        );
      }
    });
    if (typeof data.word !== "string")
    {
      throw new TypeError(
        `RefItem.parse(): data.word is not a string [${data.word}]`,
      );
    }
    return new this(data.word, data.recordingsAndTranscriptions);
  }
}

class Ref
{
  constructor(readonly type: string, readonly items: RefItem[])
  {}

  static parse(context: CheerioCrawlingContext, ref: Cheerio<AnyNode>): Ref
  {
    const data: Partial<Mutable<Ref>> = {};
    ref.children().contents().each((_, childNode) =>
    {
      const child = context.$(childNode);
      if (childNode.nodeType === 3)
        data.type = (data.type ?? "").concat(child.text());
      else if (child.prop("tagName") === "A")
      {
        const refItem = child
          .nextUntil("a")
          .addBack()
          .wrapAll("<div></div>")
          .parent();
        data.items = [...data.items ?? [], RefItem.parse(context, refItem)];
      }
    });
    if (typeof data.type !== "string")
    {
      throw new TypeError(
        `Ref.parse(): data.type is not a string [${data.type}]`,
      );
    }
    if (data.items === undefined)
      throw new TypeError(`Ref.parse(): data.items is undefined`);
    data.type = data.type.trim().slice(0, -1);
    return new this(data.type, data.items);
  }
}

class Meaning
{
  constructor(
    readonly hws: string[],
    readonly additionalInformation?: AdditionalInformation,
    readonly grammarTags?: string[],
    readonly exampleSentences?: ExampleSentence[],
    readonly thematicDictionary?: string,
    readonly note?: string,
    readonly refs?: Ref[],
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    meaning: Cheerio<AnyNode>,
  ): Meaning
  {
    const data: Partial<Mutable<Meaning>> = {};
    meaning.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("hw"))
        data.hws = [...data.hws ?? [], child.text()];
      else if (child.hasClass("grammarTag"))
      {
        data.grammarTags = [
          ...data.grammarTags ?? [],
          removeBrackets(child.text()),
        ];
      } else if (child.hasClass("meaningAdditionalInformation"))
      {
        data.additionalInformation = AdditionalInformation.parse(
          context,
          meaning.children(".meaningAdditionalInformation"),
        );
      } else if (child.hasClass("exampleSentence"))
      {
        data.exampleSentences = [
          ...data.exampleSentences ?? [],
          ExampleSentence.parse(context, child),
        ];
      } else if (child.hasClass("cat"))
        data.thematicDictionary = child.text().trim();
      else if (child.hasClass("nt"))
        data.note = child.text().trim();
      else if (child.hasClass("ref"))
        data.refs = [...data.refs ?? [], Ref.parse(context, child)];
    });
    if (data.hws === undefined)
      throw new TypeError(`Meaning.parse(): data.hws is undefined`);
    return new this(
      data.hws,
      data.additionalInformation,
      data.grammarTags,
      data.exampleSentences,
      data.thematicDictionary,
      data.note,
      data.refs,
    );
  }
}

class MeaningGroup
{
  constructor(readonly partOfSpeech: string, readonly meanings: Meaning[])
  {}

  static parse(
    context: CheerioCrawlingContext,
    meaningGroup: Cheerio<AnyNode>,
  ): MeaningGroup
  {
    const data: Partial<Mutable<MeaningGroup>> = {};
    meaningGroup.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("partOfSpeechSectionHeader"))
        data.partOfSpeech = child.children(".partOfSpeech").text();
      else if (child.hasClass("foreignToNativeMeanings"))
      {
        data.meanings = child
          .children("li")
          .map((_, meaningElement) =>
            Meaning.parse(context, context.$(meaningElement))
          )
          .get();
      }
    });
    if (typeof data.partOfSpeech !== "string")
    {
      throw new TypeError(
        `MeaningGroup.parse(): data.partOfSpeech is not a string`,
      );
    }
    if (data.meanings === undefined)
      throw new TypeError(`MeaningGroup.parse(): data.meanings is undefined`);

    return new this(data.partOfSpeech, data.meanings);
  }
}

class Header
{
  constructor(
    readonly title: string,
    readonly recordingsAndTranscriptions: RecordingsAndTranscriptions,
    readonly additionalInformation: AdditionalInformation,
    readonly lessPopular: boolean,
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    header: Cheerio<AnyNode>,
  ): Header
  {
    const data: Partial<Mutable<Header>> = {};
    header.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("hw"))
      {
        data.title = child.text().trim();
        data.lessPopular = child.hasClass("hwLessPopularAlternative");
      } else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = RecordingsAndTranscriptions.parse(
          context,
          child,
        );
      } else if (child.hasClass("dictionaryEntryHeaderAdditionalInformation"))
      {
        data.additionalInformation = AdditionalInformation.parse(
          context,
          child,
        );
      }
    });
    if (typeof data.title !== "string")
      throw new TypeError(`Header.parse(): data.title is not a string`);
    if (data.recordingsAndTranscriptions === undefined)
    {
      throw new TypeError(
        `MeaningGroup.parse(): data.recordingsAndTranscriptions is undefined`,
      );
    }
    if (data.additionalInformation === undefined)
    {
      throw new TypeError(
        `MeaningGroup.parse(): data.additionalInformation is undefined`,
      );
    }
    if (typeof data.lessPopular !== "boolean")
    {
      throw new TypeError(
        `MeaningGroup.parse(): data.lessPopular is not a boolean`,
      );
    }

    return new this(
      data.title,
      data.recordingsAndTranscriptions,
      data.additionalInformation,
      data.lessPopular,
    );
  }
}

class DictionaryEntity
{
  constructor(
    readonly headers: Header[],
    readonly meaningGroups: MeaningGroup[],
    readonly note?: string,
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    dictionaryEntity: Cheerio<AnyNode>,
  ): DictionaryEntity
  {
    const data: Partial<Mutable<DictionaryEntity>> = {};
    dictionaryEntity.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("hws"))
      {
        data.headers = child
          .children("h1")
          .children(".hw")
          .map((_, hwElement) =>
          {
            const header = context
              .$(hwElement)
              .nextUntil(".hw")
              .addBack()
              .wrapAll("<div></div>")
              .parent();
            return Header.parse(context, header);
          })
          .get();
        data.note = child.children(".nt").text() || undefined;
      } else if (child.hasClass("partOfSpeechSectionHeader"))
      {
        data.meaningGroups = child
          .map((_, partOfSpeechSectionHeaderElement) =>
          {
            const meaningGroup = context
              .$(partOfSpeechSectionHeaderElement)
              .nextUntil(".partOfSpeechSectionHeader")
              .addBack()
              .wrapAll("<div></div>")
              .parent();
            return MeaningGroup.parse(context, meaningGroup);
          })
          .get();
      }
    });
    if (data.headers === undefined)
    {
      throw new TypeError(
        "DictionaryEntity.parse(): data.headers is undefined",
      );
    }
    if (data.meaningGroups === undefined)
    {
      throw new TypeError(
        "DictionaryEntity.parse(): data.meaningGroups is undefined",
      );
    }
    return new this(data.headers, data.meaningGroups, data.note);
  }
}

router.addHandler("detail", async (context) =>
{
  context
    .$("#en-pl")
    .parent()
    .next(".diki-results-container")
    .children(".diki-results-left-column")
    .children()
    .children(".dictionaryEntity")
    .each((_, dictionaryEntityElement) =>
    {
      const dictionaryEntity = context.$(dictionaryEntityElement);
      context.pushData(DictionaryEntity.parse(context, dictionaryEntity));
    });
});
