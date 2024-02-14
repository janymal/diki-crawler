import type { AnyNode, Cheerio } from "cheerio" with {
  "resolution-mode": "require",
};
import { type CheerioCrawlingContext, createCheerioRouter } from "crawlee";
import { URL } from "node:url";

export const router = createCheerioRouter();

type Flexible<T> = { -readonly [key in keyof T]?: T[key] };

function ensureNonNullable<T>(target: T): NonNullable<T>
{
  if (target === undefined || target === null)
    throw new TypeError(`target is undefined or null`);
  return target as NonNullable<T>;
}

function getIfNotOverwriting<T>(target: T, source: T, name: string): T
{
  if (target === undefined || target === null)
    return source;
  else
    throw new Error(`overwriting the field: ${name}`);
}

const newDiv = (className: string) => `<div class="${className}"></div>`;

function logUnknownItem(
  context: CheerioCrawlingContext,
  item: Cheerio<AnyNode>,
  sectionName: string,
)
{
  context.log.warning(
    `Unknown item in the ${sectionName} section: ${item.prop("outerHTML")}`,
  );
}

class Recording
{
  static name = "Recording";
  constructor(readonly url: URL, readonly lang: string)
  {}

  static parse(
    context: CheerioCrawlingContext,
    recording: Cheerio<AnyNode>,
  ): Recording
  {
    const data: Flexible<Recording> = {};
    data.lang = getIfNotOverwriting(
      data.lang,
      recording.attr("class")?.split(" ")[0],
      "lang",
    );
    data.url = getIfNotOverwriting(
      data.url,
      new URL(
        ensureNonNullable(
          recording
            .children(".soundOnClick")
            .attr("data-audio-url"),
        ),
        context.request.url,
      ),
      "url",
    );
    return new this(ensureNonNullable(data.url), ensureNonNullable(data.lang));
  }
}

class RecordingsAndTranscriptions
{
  static name = "Recordings and Transcriptions";
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
  static name = "Additional Information";
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
      {
        data.popularity = getIfNotOverwriting(
          data.popularity,
          child.text().length,
          "popularity",
        );
      } else if (child.hasClass("languageVariety"))
      {
        data.languageVariety = getIfNotOverwriting(
          data.languageVariety,
          child.text(),
          "languageVariety",
        );
      } else if (child.hasClass("languageRegister"))
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
        logUnknownItem(context, child, this.name);
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
  static name = "Example Sentence";
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
      {
        data.translation = getIfNotOverwriting(
          data.translation,
          child
            .text()
            .trim()
            .slice(1, -1),
          "translation",
        );
      } else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = getIfNotOverwriting(
          data.recordingsAndTranscriptions,
          RecordingsAndTranscriptions.parse(
            context,
            exampleSentence.children(".recordingsAndTranscriptions"),
          ),
          "recordingsAndTranscriptions",
        );
      } else if (child.hasClass("repetitionAddOrRemoveIconAnchor"))
        return;
      else
        logUnknownItem(context, child, this.name);
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
  static name = "Ref Item";
  constructor(
    readonly term: string,
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
        data.term = getIfNotOverwriting(data.term, child.text(), "term");
      else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = getIfNotOverwriting(
          data.recordingsAndTranscriptions,
          RecordingsAndTranscriptions.parse(context, child),
          "recordingsAndTranscriptions",
        );
      } else
      {
        logUnknownItem(context, child, this.name);
      }
    });
    return new this(
      ensureNonNullable(data.term),
      data.recordingsAndTranscriptions,
    );
  }
}

class Ref
{
  static name = "Ref";
  constructor(readonly type: string, readonly items: RefItem[])
  {}

  static parse(context: CheerioCrawlingContext, ref: Cheerio<AnyNode>): Ref
  {
    const data: Flexible<Ref> = {};
    let secondSectionStartIndex: number | undefined;
    const refContents = ref.children().contents();
    refContents.each((i, childNode) =>
    {
      const child = context.$(childNode);
      if (childNode.nodeType === 3)
        data.type = (data.type ?? "").concat(child.text());
      else if (child.prop("tagName") === "A")
      {
        secondSectionStartIndex = i;
        return false;
      } else if (child.hasClass("refIcon"))
        return;
      else
        logUnknownItem(context, child, this.name);
      return true;
    });
    data.items = refContents
      .slice(secondSectionStartIndex)
      .filter("a")
      .map((_, aElement) =>
      {
        const refItem = context
          .$(aElement)
          .nextUntil("a")
          .addBack()
          .wrapAll(newDiv("refItem"))
          .parent();
        return RefItem.parse(context, refItem);
      })
      .get();
    return new this(
      ensureNonNullable(data.type).trim().slice(0, -1),
      data.items,
    );
  }
}

class Meaning
{
  static name = "Meaning";
  constructor(
    readonly id: string,
    readonly terms: string,
    readonly notForChildren: boolean,
    readonly additionalInformation?: AdditionalInformation,
    readonly grammarTags?: string[],
    readonly mf?: string, // TODO: figure out what actually that is
    readonly exampleSentences?: ExampleSentence[],
    readonly thematicDictionary?: string,
    readonly note?: string,
    readonly refs?: Ref[],
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    meaning: Cheerio<AnyNode>,
    isNotForChildren: boolean = false,
    id?: string,
  ): Meaning
  {
    const data: Flexible<Meaning> = {};
    let meaningNotForChildren: Cheerio<AnyNode> | undefined;
    let foundNotForChildren = false;
    meaning.contents().each((_, childNode) =>
    {
      const child = context.$(childNode);
      if (child.hasClass("hiddenNotForChildrenMeaning"))
      {
        foundNotForChildren = true;
        meaningNotForChildren = child;
        return false;
      } else if (child.hasClass("hw") || childNode.nodeType === 3)
        data.terms = (data.terms ?? "").concat(child.text());
      else if (child.hasClass("grammarTag"))
      {
        data.grammarTags = [
          ...data.grammarTags ?? [],
          child.text().slice(1, -1),
        ];
      } else if (child.hasClass("meaningAdditionalInformation"))
      {
        data.additionalInformation = getIfNotOverwriting(
          data.additionalInformation,
          AdditionalInformation.parse(
            context,
            meaning.children(".meaningAdditionalInformation"),
          ),
          "additionalInformation",
        );
      } else if (child.hasClass("exampleSentence"))
      {
        data.exampleSentences = [
          ...data.exampleSentences ?? [],
          ExampleSentence.parse(context, child),
        ];
      } else if (child.hasClass("cat"))
      {
        data.thematicDictionary = getIfNotOverwriting(
          data.thematicDictionary,
          child.text().trim(),
          "thematicDictionary",
        );
      } else if (child.hasClass("ref"))
        data.refs = [...data.refs ?? [], Ref.parse(context, child)];
      else if (child.hasClass("nt"))
        data.note = getIfNotOverwriting(data.note, child.text().trim(), "note");
      else if (child.hasClass("mf"))
        data.mf = getIfNotOverwriting(data.mf, child.text().trim(), "mf");
      else if (child.hasClass("repetitionAddOrRemoveIconAnchor"))
        return;
      else
        logUnknownItem(context, child, this.name);
      return true;
    });
    let idFromAttr = meaning.attr("id")?.trim().slice(7, -3);
    if (foundNotForChildren)
    {
      return this.parse(
        context,
        ensureNonNullable(meaningNotForChildren),
        foundNotForChildren,
        idFromAttr,
      );
    }
    return new this(
      ensureNonNullable(id ?? idFromAttr),
      ensureNonNullable(data.terms).trim(),
      isNotForChildren,
      data.additionalInformation,
      data.grammarTags,
      data.mf,
      data.exampleSentences,
      data.thematicDictionary,
      data.note,
      data.refs,
    );
  }
}

class Form
{
  static name = "Form";
  constructor(
    readonly term: string,
    readonly form: string,
    readonly recordingsAndTranscriptions?: RecordingsAndTranscriptions,
  )
  {}

  static parse(context: CheerioCrawlingContext, form: Cheerio<AnyNode>): Form
  {
    const data: Flexible<Form> = {};
    form.children().each((_, childElement) =>
    {
      const child = context.$(childElement);
      if (child.hasClass("foreignTermText"))
        data.term = getIfNotOverwriting(data.term, child.text(), "term");
      else if (child.hasClass("foreignTermHeader"))
        data.form = getIfNotOverwriting(data.form, child.text(), "form");
      else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = getIfNotOverwriting(
          data.recordingsAndTranscriptions,
          RecordingsAndTranscriptions.parse(context, child),
          "recordingsAndTranscriptions",
        );
      } else
      {
        logUnknownItem(context, child, this.name);
      }
    });

    return new this(
      ensureNonNullable(data.term),
      ensureNonNullable(data.form),
      data.recordingsAndTranscriptions,
    );
  }
}

class MeaningGroup
{
  static name = "Meaning Group";
  constructor(
    readonly meanings: Meaning[],
    readonly irregularForms?: Form[],
    readonly partOfSpeech?: string,
  )
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
      {
        data.partOfSpeech = getIfNotOverwriting(
          data.partOfSpeech,
          child.children(".partOfSpeech").text(),
          "partOfSpeech",
        );
      } else if (child.hasClass("foreignToNativeMeanings"))
      {
        data.meanings = child
          .children("li")
          .map((_, meaningElement) =>
            Meaning.parse(context, context.$(meaningElement))
          )
          .get();
      } else if (child.hasClass("vf"))
      {
        data.irregularForms = child
          .children(".foreignTermText")
          .map((_, foreignTermTextElement) =>
          {
            const form = context
              .$(foreignTermTextElement)
              .nextUntil(".foreignTermText")
              .addBack()
              .wrapAll(newDiv("form"))
              .parent();
            return Form.parse(context, form);
          })
          .get();
      } else if (child.hasClass("additionalSentences"))
        return;
      else
        logUnknownItem(context, child, this.name);
    });
    return new this(
      ensureNonNullable(data.meanings),
      data.irregularForms,
      data.partOfSpeech,
    );
  }
}

class Header
{
  static name = "Header";
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
        data.title = getIfNotOverwriting(
          data.title,
          child.text().trim(),
          "title",
        );
        data.lessPopular = child.hasClass("hwLessPopularAlternative");
      } else if (child.hasClass("recordingsAndTranscriptions"))
      {
        data.recordingsAndTranscriptions = getIfNotOverwriting(
          data.recordingsAndTranscriptions,
          RecordingsAndTranscriptions.parse(context, child),
          "recordingsAndTranscriptions",
        );
      } else if (child.hasClass("dictionaryEntryHeaderAdditionalInformation"))
      {
        data.additionalInformation = getIfNotOverwriting(
          data.additionalInformation,
          AdditionalInformation.parse(context, child),
          "additionalInformation",
        );
      } else if (child.prop("tagName") === "BR")
        return;
      else
        logUnknownItem(context, child, this.name);
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
  static name = "Dictionary Entity";
  constructor(
    readonly headers: Header[],
    readonly meaningGroups: MeaningGroup[],
    readonly note?: string,
    readonly pictures?: URL[],
  )
  {}

  static parse(
    context: CheerioCrawlingContext,
    dictionaryEntity: Cheerio<AnyNode>,
  ): DictionaryEntity
  {
    const data: Flexible<DictionaryEntity> = {};
    let secondSectionStartIndex: number | undefined;
    const dictionaryEntityChildren = dictionaryEntity.children();
    dictionaryEntityChildren.each((i, childElement) =>
    {
      const child = context.$(childElement);
      if (
        child.hasClass("partOfSpeechSectionHeader") ||
        child.hasClass("foreignToNativeMeanings")
      )
      {
        secondSectionStartIndex = i;
        return false;
      } else if (child.hasClass("hws"))
      {
        data.headers = child
          .children("h1")
          .children(".hw")
          .map((_, hwElement) =>
          {
            const header = context
              .$(hwElement)
              .nextUntil(".hw, .hwcomma")
              .addBack()
              .wrapAll(newDiv("header"))
              .parent();
            return Header.parse(context, header);
          })
          .get();
        data.note = getIfNotOverwriting(
          data.note,
          child.children(".nt").text() || undefined,
          "note",
        );
      } else if (child.hasClass("dictpict"))
      {
        data.pictures = [
          ...data.pictures ?? [],
          new URL(
            ensureNonNullable(
              child
                .children("img")
                .attr("src"),
            ),
            context.request.url,
          ),
        ];
      } else
      {
        logUnknownItem(context, child, this.name);
      }
      return true;
    });
    data.meaningGroups = dictionaryEntityChildren
      .slice(secondSectionStartIndex)
      .filter(".foreignToNativeMeanings")
      .map((_, foreignToNativeMeaningsElement) =>
      {
        const meaningGroup = context
          .$(foreignToNativeMeaningsElement)
          .prev(".partOfSpeechSectionHeader")
          .addBack()
          .nextUntil(
            ".foreignToNativeMeanings",
            ":not(.partOfSpeechSectionHeader)",
          )
          .addBack()
          .wrapAll(newDiv("meaningGroup"))
          .parent();
        return MeaningGroup.parse(context, meaningGroup);
      })
      .get();
    return new this(
      ensureNonNullable(data.headers),
      data.meaningGroups,
      data.note,
      data.pictures,
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
  await context.enqueueLinks({
    globs: ["http?(s)://www.diki.pl/slownik-angielskiego?q=*"],
    label: "detail"
  });
});
