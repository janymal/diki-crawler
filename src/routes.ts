import type { AnyNode, Cheerio } from "cheerio" with {
  "resolution-mode": "require",
};
import { type CheerioCrawlingContext, createCheerioRouter } from "crawlee";
import { URL } from "node:url";

export const router = createCheerioRouter();

const removeBrackets = (str: string) => str.slice(1, -1);
const getTextNodes = (element: Cheerio<AnyNode>) =>
  element.contents().filter((_, node) => node.nodeType === 3);
const parseNote = (element: Cheerio<AnyNode>) =>
  getTextNodes(element.children(".nt")).text().trim();

type Mutable<T> = { -readonly [key in keyof T]: T[key] };

abstract class Parsable
{
  static parse: (
    context: CheerioCrawlingContext,
    section: Cheerio<AnyNode>,
  ) => Parsable;
}

class Recording implements Parsable
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

    if (typeof data.lang !== "string" || typeof audioUrl !== "string")
      throw new TypeError();

    data.url = new URL(audioUrl, context.request.url);
    return new this(data.url, data.lang);
  }
}

class RecordingsAndTranscriptions implements Parsable
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
          throw new TypeError();
        data.transcriptions = [...data.transcriptions ?? [], url];
      }
    });
    return new this(data.recordings, data.transcriptions);
  }
}

class AdditionalInformation implements Parsable
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
        data.other = [
          ...(data.other ?? []),
          removeBrackets(
            child
              .text()
              .trim(),
          ),
        ];
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

class ExampleSentence implements Parsable
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
        data.sentence = child.text();
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
    data.sentence = getTextNodes(exampleSentence).text().trim();
    if (typeof data.translation !== "string")
      throw new TypeError();
    return new this(
      data.sentence,
      data.translation,
      data.recordingsAndTranscriptions,
    );
  }
}

class RefItem implements Parsable
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
    data.word = refItem.children().first().text();
    data.recordingsAndTranscriptions = RecordingsAndTranscriptions.parse(
      context,
      refItem.children(".recordingsAndTranscriptions"),
    );
    return new this(data.word, data.recordingsAndTranscriptions);
  }
}

class Ref implements Parsable
{
  constructor(readonly type: string, readonly items: RefItem[])
  {}

  static parse(context: CheerioCrawlingContext, ref: Cheerio<AnyNode>): Ref
  {
    const data: Partial<Mutable<Ref>> = {};
    data.type = getTextNodes(ref.parent()).first().text().trim().slice(0, -1);
    data.items = ref
      .children()
      .children("a")
      .map((_, refItemWordElement) =>
      {
        const refItem = context
          .$(refItemWordElement)
          .nextUntil("a")
          .addBack()
          .wrapAll("<div></div>")
          .parent();
        return RefItem.parse(context, refItem);
      })
      .get();
    return new this(data.type, data.items);
  }
}

class Meaning implements Parsable
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
    data.hws = meaning
      .children(".hw")
      .map((_, hwElement) => context.$(hwElement).text())
      .get(),
      data.grammarTags = meaning
        .children(".grammarTag")
        .map((_, tag) => removeBrackets(context.$(tag).text()))
        .get();
    data.additionalInformation = AdditionalInformation.parse(
      context,
      meaning.children(".meaningAdditionalInformation"),
    );
    data.exampleSentences = meaning
      .children(".exampleSentence")
      .map((_, exampleSentenceElement) =>
        ExampleSentence.parse(context, context.$(exampleSentenceElement))
      )
      .get();
    data.thematicDictionary = meaning.children(".cat").text().trim();
    data.note = parseNote(meaning);
    data.refs = meaning
      .children(".ref")
      .map((_, refElement) => Ref.parse(context, context.$(refElement)))
      .get();
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

class MeaningGroup implements Parsable
{
  constructor(readonly partOfSpeech: string, readonly meanings: Meaning[])
  {}

  static parse(
    context: CheerioCrawlingContext,
    meaningGroup: Cheerio<AnyNode>,
  ): MeaningGroup
  {
    const data: Partial<Mutable<MeaningGroup>> = {};
    data.partOfSpeech = meaningGroup
      .children(".partOfSpeechSectionHeader")
      .children(".partOfSpeech")
      .text();
    data.meanings = meaningGroup
      .children(".foreignToNativeMeanings")
      .children("li")
      .map((_, meaningElement) =>
        Meaning.parse(context, context.$(meaningElement))
      )
      .get();
    return new this(data.partOfSpeech, data.meanings);
  }
}

class Header implements Parsable
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
    data.title = header.children().first().text().trim();
    data.recordingsAndTranscriptions = RecordingsAndTranscriptions.parse(
      context,
      header.children(".recordingsAndTranscriptions"),
    );
    data.additionalInformation = AdditionalInformation.parse(
      context,
      header.children(".dictionaryEntryHeaderAdditionalInformation"),
    );
    data.lessPopular = header.hasClass("hwLessPopularAlternative");
    return new this(
      data.title,
      data.recordingsAndTranscriptions,
      data.additionalInformation,
      data.lessPopular,
    );
  }
}

class DictionaryEntity implements Parsable
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
    data.headers = dictionaryEntity
      .children(".hws")
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
    data.meaningGroups = dictionaryEntity
      .children(".partOfSpeechSectionHeader")
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
    data.note = dictionaryEntity.children(".hws").children(".nt").text().trim();
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
