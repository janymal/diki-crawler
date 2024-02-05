import { createCheerioRouter, type CheerioCrawlingContext } from "crawlee";
import url from "url";
import type {
  BasicAcceptedElems,
  AnyNode,
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
  element: BasicAcceptedElems<AnyNode> | undefined,
): IRecording[] {
  return ctx.$(element)
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
  element: BasicAcceptedElems<AnyNode> | undefined,
): IAdditionalInformation {
  let popularity = undefined;
  let variety = undefined;
  let register = undefined;
  ctx.$(element)
    .children()
    .each((_, el) => {
      if (ctx.$(el).hasClass("starsForNumOccurrences"))
        popularity = ctx.$(el).text().length;
      else if (ctx.$(el).hasClass("languageVariety")) variety = ctx.$(el).text();
      else if (ctx.$(el).hasClass("languageRegister")) register = ctx.$(el).text();
    });
  return {
    languageVariety: variety,
    languageRegister: register,
    popularity: popularity,
    other: removeBrackets(getTextNodes(ctx, element)).split(","),
  };
}

function removeBrackets(str: string): string {
  return str.substring(1, str.length - 1);
}

function getTextNodes(
  ctx: CheerioCrawlingContext,
  element: BasicAcceptedElems<AnyNode> | undefined,
): string {
  return ctx.$(element)
    .contents()
    .filter(function () {
      return this.nodeType == 3;
    })
    .text()
    .trim();
}

function getNote(
  ctx: CheerioCrawlingContext,
  el: BasicAcceptedElems<AnyNode> | undefined,
): string {
  const noteElement = ctx.$(el).children(".nt").get(0);
  return getTextNodes(ctx, noteElement);
}

function getRefs(
  ctx: CheerioCrawlingContext,
  el: BasicAcceptedElems<AnyNode> | undefined,
): IRef[] {
  return ctx.$(el)
    .children(".ref")
    .children("div")
    .children("a")
    .map((_, el) => {
      const recordings = ctx.$(el).nextAll(".recordingsAndTranscriptions").get(0);
      return {
        word: ctx.$(el).text(),
        type: getTextNodes(ctx, ctx.$(el).parent().get(0)).split(":")[0],
        recordings: getRecordings(ctx, recordings),
      };
    })
    .toArray();
}

function getHws(
  ctx: CheerioCrawlingContext,
  el: BasicAcceptedElems<AnyNode> | undefined,
): IHw[] {
  return ctx.$(el)
    .children("h1")
    .children(".hw")
    .map((_, el) => {
      const additionalInformation = ctx.$(el)
        .nextAll(".dictionaryEntryHeaderAdditionalInformation")
        .get(0);
      const recordingsAndTranscriptions = ctx.$(el)
        .nextAll(".recordingsAndTranscriptions")
        .get(0);
      const hw: IHw = {
        title: ctx.$(el).text().trim(),
        transcription: ctx.$(recordingsAndTranscriptions)
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
  element: BasicAcceptedElems<AnyNode> | undefined,
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
        sentence: getTextNodes(ctx, el),
        translation: removeBrackets(translation),
        recordings: getRecordings(ctx, recordings),
      };
    })
    .get()
}

function getMeanings(
  ctx: CheerioCrawlingContext,
  el: BasicAcceptedElems<AnyNode> | undefined,
): IMeaning[] {
  return ctx.$(el)
    .nextAll(".foreignToNativeMeanings")
    .children("li")
    .map((_, el) => {
      const additionalInformation = ctx.$(el)
        .children(".meaningAdditionalInformation")
        .get(0);
      const meaning: IMeaning = {
        hws: ctx.$(el)
          .children(".hw")
          .map((_, el) => ctx.$(el).text().trim())
          .toArray(),
        grammarTags: ctx.$(el)
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
        exampleSentences: getExampleSentences(ctx, el),
        thematicDictionary: ctx.$(el).children(".cat").text().trim(),
        note: getNote(ctx, el),
        refs: getRefs(ctx, el),
      };
      return meaning;
    })
    .toArray();
}

function getMeaningGroups(
  ctx: CheerioCrawlingContext,
  el: BasicAcceptedElems<AnyNode> | undefined
): IMeaningGroup[] {
  return ctx.$(el)
    .children(".partOfSpeechSectionHeader")
    .map((_, el) => {
      const meaningGroup: IMeaningGroup = {
        partOfSpeech: ctx.$(el).children(".partOfSpeech").text(),
        meanings: getMeanings(ctx, el),
      };
      return meaningGroup;
    })
    .toArray();
}
router.addHandler("detail", async (ctx) => {
  const dictionaryEntities = ctx.$("div .diki-results-left-column")
    .children("div")
    .children("div .dictionaryEntity");
  dictionaryEntities.each((_, el) => {
    const entity: IEntity = {
      hws: getHws(ctx, ctx.$(el).children(".hws").get(0)),
      meaningGroups: getMeaningGroups(ctx, el),
      note: getNote(ctx, ctx.$(el).children(".hws").get(0)),
    };
    ctx.pushData({ entity });
  });
});
