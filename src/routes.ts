import { createCheerioRouter, type CheerioCrawlingContext } from "crawlee";
import url from "url";
import type {
  Cheerio,
  Element,
} from "cheerio" with { "resolution-mode": "require" };

export const router = createCheerioRouter();

interface IEntity {
  hws: IHw[];
  meaningGroups: IMeaningGroup[];
  note?: string;
}

interface IRecording {
  url: string;
  lang: string;
}

interface IHw {
  title: string;
  transcription?: string;
  recordings?: IRecording[];
  additionalInformation: IAdditionalInformation;
  lessPopular: boolean;
}

interface IMeaningGroup {
  partOfSpeech: string;
  meanings: IMeaning[];
}

interface IAdditionalInformation {
  languageVariety?: string;
  popularity?: number;
  languageRegister?: string[];
  other?: string[];
}

interface IMeaning {
  hws: string[];
  additionalInformation: IAdditionalInformation;
  grammarTags?: string[];
  exampleSentences: IExampleSentence[];
  thematicDictionary?: string;
  note?: string;
  refs?: IRef[];
}

interface IRef {
  word: string;
  type: string;
  recordings?: IRecording[];
}

interface IExampleSentence {
  sentence: string;
  translation: string;
  recordings: IRecording[];
}

function getRecordings(
  ctx: CheerioCrawlingContext,
  element: Cheerio<Element>,
): IRecording[] {
  return element
    ?.children(".hasRecording")
    .map((_, el) => {
      return {
        lang: ctx.$(el).attr("class")!.split(" ")[0],
        url: url.resolve(
          ctx.request.url,
          ctx.$(el).children(".soundOnClick").attr("data-audio-url")!,
        ),
      };
    })
    .toArray();
}

function getAdditionalInformation(
  ctx: CheerioCrawlingContext,
  element: Cheerio<Element>,
): IAdditionalInformation {
  let popularity = undefined;
  let variety = undefined;
  let register = undefined;
  element
    .children()
    .each((_, el) => {
      if (ctx.$(el).hasClass("starsForNumOccurrences"))
        popularity = ctx.$(el).text().length;
      else if (ctx.$(el).hasClass("languageVariety"))
        variety = ctx.$(el).text();
      else if (ctx.$(el).hasClass("languageRegister"))
        register = ctx.$(el).text();
    });
  return {
    languageVariety: variety,
    languageRegister: register,
    popularity: popularity,
    other: removeBrackets(getTextNodes(element)).split(","),
  };
}

function removeBrackets(str: string): string {
  return str.substring(1, str.length - 1);
}

function getTextNodes(element: Cheerio<Element>): string {
  return element
    .contents()
    .filter(function () {
      return this.nodeType == 3;
    })
    .text()
    .trim();
}

function getNote(element: Cheerio<Element>): string {
  const noteElement = element.children(".nt");
  return getTextNodes(noteElement);
}

function getRefs(ctx: CheerioCrawlingContext, element: Cheerio<Element>): IRef[] {
  return element
    .children(".ref")
    .children("div")
    .children("a")
    .map((_, el) => {
      const recordings = ctx.$(el).nextAll(".recordingsAndTranscriptions");
      return {
        word: ctx.$(el).text(),
        type: getTextNodes(ctx.$(el).parent()).split(":")[0],
        recordings: getRecordings(ctx, recordings),
      };
    })
    .toArray();
}

function getHws(ctx: CheerioCrawlingContext, element: Cheerio<Element>): IHw[] {
  return element
    .children("h1")
    .children(".hw")
    .map((_, el) => {
      const additionalInformation = ctx
        .$(el)
        .nextAll(".dictionaryEntryHeaderAdditionalInformation")
        .first();
      const recordingsAndTranscriptions = ctx
        .$(el)
        .nextAll(".recordingsAndTranscriptions")
        .first();
      const hw: IHw = {
        title: ctx.$(el).text().trim(),
        transcription: ctx
          .$(recordingsAndTranscriptions)
          ?.children(".phoneticTranscription")
          .children("a")
          .children("img")
          .attr("src"),
        recordings: getRecordings(ctx, recordingsAndTranscriptions),
        additionalInformation: getAdditionalInformation(
          ctx,
          additionalInformation,
        ),
        lessPopular: ctx.$(el).hasClass("hwLessPopularAlternative"),
      };
      return hw;
    })
    .toArray();
}

function getExampleSentences(
  ctx: CheerioCrawlingContext,
  element: Cheerio<Element> | undefined,
): IExampleSentence[] {
  return ctx
    .$(element)
    .children(".exampleSentence")
    .map((_, el) => {
      const translation = ctx.$(el)
        .children(".exampleSentenceTranslation")
        .text()
        .trim();
      const recordings = ctx.$(el)
        .children(".recordingsAndTranscriptions");
      return {
        sentence: getTextNodes(ctx.$(el)),
        translation: removeBrackets(translation),
        recordings: getRecordings(ctx, recordings),
      };
    })
    .get()
}

function getMeanings(
  ctx: CheerioCrawlingContext,
  element: Cheerio<Element>,
): IMeaning[] {
  return element
    .nextAll(".foreignToNativeMeanings")
    .children("li")
    .map((_, el) => {
      const additionalInformation = ctx
        .$(el)
        .children(".meaningAdditionalInformation");
      const meaning: IMeaning = {
        hws: ctx
          .$(el)
          .children(".hw")
          .map((_, el) => ctx.$(el).text().trim())
          .toArray(),
        grammarTags: ctx
          .$(el)
          .children(".grammarTag")
          .map((_, el) => {
            const t = ctx.$(el).text();
            return removeBrackets(t);
          })
          .toArray(),
        additionalInformation: getAdditionalInformation(
          ctx,
          additionalInformation,
        ),
        exampleSentences: getExampleSentences(ctx, ctx.$(el)),
        thematicDictionary: ctx.$(el).children(".cat").text().trim(),
        note: getNote(ctx.$(el)),
        refs: getRefs(ctx, ctx.$(el)),
      };
      return meaning;
    })
    .toArray();
}

function getMeaningGroups(
  ctx: CheerioCrawlingContext,
  element: Cheerio<Element>,
): IMeaningGroup[] {
  return element
    .children(".partOfSpeechSectionHeader")
    .map((_, el) => {
      const meaningGroup: IMeaningGroup = {
        partOfSpeech: ctx.$(el).children(".partOfSpeech").text(),
        meanings: getMeanings(ctx, ctx.$(el)),
      };
      return meaningGroup;
    })
    .toArray();
}
router.addHandler("detail", async (ctx) => {
  const dictionaryEntities = ctx
    .$("div .diki-results-left-column")
    .children("div")
    .children("div .dictionaryEntity");
  dictionaryEntities.each((_, el) => {
    const entity: IEntity = {
      hws: getHws(ctx, ctx.$(el).children(".hws")),
      meaningGroups: getMeaningGroups(ctx, ctx.$(el)),
      note: getNote(ctx.$(el).children(".hws")),
    };
    ctx.pushData({ entity });
  });
});
