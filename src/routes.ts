import type { AnyNode, Cheerio } from "cheerio" with {
  "resolution-mode": "require",
};
import { type CheerioCrawlingContext, createCheerioRouter } from "crawlee";
import { URL } from "node:url";

export const router = createCheerioRouter();

type Flexible<T> = { -readonly [key in keyof T]?: T[key] };

const emptyDiv = "<div></div>";

function ensureNonNullable<T>(target: T): NonNullable<T>
{
  if (target === undefined || target === null)
    throw new TypeError(`target is undefined or null`);
  return target as NonNullable<T>;
}

class Recording
{
  constructor(readonly url: URL, readonly lang: string)
  {}

  static parse(
    context: CheerioCrawlingContext,
    recording: Cheerio<AnyNode>,
  ): Recording
  {
    const data: Flexible<Recording> = {};
    data.lang = recording.attr("class")?.split(" ")[0];
    data.url = new URL(
      ensureNonNullable(
        recording
          .children(".soundOnClick")
          .attr("data-audio-url"),
      ),
      context.request.url,
    );
    return new this(data.url, ensureNonNullable(data.lang));
  }
}

class RecordingsAndTranscriptions
{
  constructor(
    readonly recordings?: Recording[],
    readonly transcriptions?: URL[],
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    recordingsAndTranscriptions: Cheerio<AnyNode>,
  ): RecordingsAndTranscriptions | undefined
  {
    const data: Flexible<RecordingsAndTranscriptions> = {};
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
        data.transcriptions = [
          ...data.transcriptions ?? [],
          new URL(ensureNonNullable(url)),
        ];
      }
    });

    if (Object.keys(data).length > 0)
      return new this(data.recordings, data.transcriptions);
    return undefined;
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
  ): AdditionalInformation | undefined
  {
    const data: Flexible<AdditionalInformation> = {};
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
        const nodeText = child.text().trim().slice(1, -1) || undefined;
        if (nodeText)
          data.other = [...data.other ?? [], nodeText];
      } else
      {
        context.log.warning(
          `Unknown field in the Additional Information section: ${child.html()}`,
        );
      }
    });

    if (Object.keys(data).length > 0)
    {
      return new this(
        data.languageRegister,
        data.languageVariety,
        data.other,
        data.popularity,
      );
    }
    return undefined;
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
    const data: Flexible<ExampleSentence> = {};
    exampleSentence.contents().each((_, childNode) =>
    {
      const child = context.$(childNode);
      if (childNode.nodeType === 3)
        data.sentence = (data.sentence ?? "").concat(child.text());
      else if (child.hasClass("exampleSentenceTranslation"))
        data.translation = child.text().trim().slice(1, -1);
      else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = RecordingsAndTranscriptions.parse(
          context,
          exampleSentence.children(".recordingsAndTranscriptions"),
        );
      }
    });
    return new this(
      ensureNonNullable(data.sentence).trim(),
      ensureNonNullable(data.translation),
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
    const data: Flexible<RefItem> = {};
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
    return new this(
      ensureNonNullable(data.word),
      data.recordingsAndTranscriptions,
    );
  }
}

class Ref
{
  constructor(readonly type: string, readonly items: RefItem[])
  {}

  static parse(context: CheerioCrawlingContext, ref: Cheerio<AnyNode>): Ref
  {
    const data: Flexible<Ref> = {};
    ref.children().contents().each((_, childNode) =>
    {
      const child = context.$(childNode);
      if (childNode.nodeType === 3)
        data.type = data.type || child.text().trim().slice(0, -1);
      else if (child.prop("tagName") === "A")
      {
        const refItem = child
          .nextUntil("a")
          .addBack()
          .wrapAll(emptyDiv)
          .parent();
        data.items = [...data.items ?? [], RefItem.parse(context, refItem)];
      }
    });
    return new this(
      ensureNonNullable(data.type),
      ensureNonNullable(data.items),
    );
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
    const data: Flexible<Meaning> = {};
    meaning.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("hw"))
        data.hws = [...data.hws ?? [], child.text()];
      else if (child.hasClass("grammarTag"))
      {
        data.grammarTags = [
          ...data.grammarTags ?? [],
          child.text().slice(1, -1),
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
    return new this(
      ensureNonNullable(data.hws),
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
    const data: Flexible<MeaningGroup> = {};
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
    return new this(
      ensureNonNullable(data.partOfSpeech),
      ensureNonNullable(data.meanings),
    );
  }
}

class Header
{
  constructor(
    readonly title: string,
    readonly lessPopular: boolean,
    readonly additionalInformation?: AdditionalInformation,
    readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    header: Cheerio<AnyNode>,
  ): Header
  {
    const data: Flexible<Header> = {};
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

    return new this(
      ensureNonNullable(data.title),
      ensureNonNullable(data.lessPopular),
      data.additionalInformation,
      data.recordingsAndTranscriptions,
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
    const data: Flexible<DictionaryEntity> = {};
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
              .wrapAll(emptyDiv)
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
              .wrapAll(emptyDiv)
              .parent();
            return MeaningGroup.parse(context, meaningGroup);
          })
          .get();
      }
    });
    return new this(
      ensureNonNullable(data.headers),
      ensureNonNullable(data.meaningGroups),
      data.note,
    );
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
