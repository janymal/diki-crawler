import { createCheerioRouter } from "crawlee";
import url from "url";
import type {
  CheerioAPI,
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
  $: CheerioAPI,
  element: BasicAcceptedElems<AnyNode> | undefined,
  request_url: string = "",
): IRecording[] {
  return $(element)
    ?.children(".hasRecording")
    .map((_, el) => {
      return {
        lang: $(el).attr("class")!.split(" ")[0],
        url: url.resolve(
          request_url,
          $(el).children(".soundOnClick").attr("data-audio-url")!,
        ),
      };
    })
    .toArray();
}

function getAdditionalInformation(
  $: CheerioAPI,
  element: BasicAcceptedElems<AnyNode> | undefined,
): IAdditionalInformation {
  let popularity = undefined;
  let variety = undefined;
  let register = undefined;
  $(element)
    .children()
    .each((_, el) => {
      if ($(el).hasClass("starsForNumOccurrences"))
        popularity = $(el).text().length;
      else if ($(el).hasClass("languageVariety")) variety = $(el).text();
      else if ($(el).hasClass("languageRegister")) register = $(el).text();
    });
  return {
    languageVariety: variety,
    languageRegister: register,
    popularity: popularity,
    other: removeBrackets(getTextNodes($, element)).split(","),
  };
}

function removeBrackets(str: string): string {
  return str.substring(1, str.length - 1);
}

function getTextNodes(
  $: CheerioAPI,
  element: BasicAcceptedElems<AnyNode> | undefined,
): string {
  return $(element)
    .contents()
    .filter(function () {
      return this.nodeType == 3;
    })
    .text()
    .trim();
}

function getNote(
  $: CheerioAPI,
  el: BasicAcceptedElems<AnyNode> | undefined,
): string {
  const noteElement = $(el).children(".nt").get(0);
  return getTextNodes($, noteElement);
}

function getRefs(
  $: CheerioAPI,
  el: BasicAcceptedElems<AnyNode> | undefined,
  request_url: string,
): IRef[] {
  return $(el)
    .children(".ref")
    .children("div")
    .children("a")
    .map((_, el) => {
      const recordings = $(el).nextAll(".recordingsAndTranscriptions").get(0);
      return {
        word: $(el).text(),
        type: getTextNodes($, $(el).parent().get(0)).split(":")[0],
        recordings: getRecordings($, recordings, request_url),
      };
    })
    .toArray();
}

function getHws(
  $: CheerioAPI,
  el: BasicAcceptedElems<AnyNode> | undefined,
  request_url: string,
): IHw[] {
  return $(el)
    .children("h1")
    .children(".hw")
    .map((_, el) => {
      const additionalInformation = $(el)
        .nextAll(".dictionaryEntryHeaderAdditionalInformation")
        .get(0);
      const recordingsAndTranscriptions = $(el)
        .nextAll(".recordingsAndTranscriptions")
        .get(0);
      const hw: IHw = {
        title: $(el).text().trim(),
        transcription: $(recordingsAndTranscriptions)
          ?.children(".phoneticTranscription")
          .children("a")
          .children("img")
          .attr("src"),
        recordings: getRecordings($, recordingsAndTranscriptions, request_url),
        additionalInformation: getAdditionalInformation(
          $,
          additionalInformation,
        ),
        lessPopular: $(el).hasClass("hwLessPopularAlternative"),
      };
      return hw;
    })
    .toArray();
}

function getExampleSentences(
  $: CheerioAPI,
  element: BasicAcceptedElems<AnyNode> | undefined,
  request_url: string,
): IExampleSentence[] {
  return $(element)
    .children(".exampleSentence")
    .map((_, el) => {
      const translation = $(el)
        .children(".exampleSentenceTranslation")
        .text()
        .trim();
      const recordings = $(el)
        .children(".recordingsAndTranscriptions");
      return {
        sentence: getTextNodes($, el),
        translation: removeBrackets(translation),
        recordings: getRecordings($, recordings, request_url),
      };
    })
    .get()
}

function getMeanings(
  $: CheerioAPI,
  el: BasicAcceptedElems<AnyNode> | undefined,
  request_url: string,
): IMeaning[] {
  return $(el)
    .nextAll(".foreignToNativeMeanings")
    .children("li")
    .map((_, el) => {
      const additionalInformation = $(el)
        .children(".meaningAdditionalInformation")
        .get(0);
      const meaning: IMeaning = {
        hws: $(el)
          .children(".hw")
          .map((_, el) => $(el).text().trim())
          .toArray(),
        grammarTags: $(el)
          .children(".grammarTag")
          .map((_, el) => {
            const t = $(el).text();
            return removeBrackets(t);
          })
          .toArray(),
        additionalInformation: getAdditionalInformation(
          $,
          additionalInformation,
        ),
        exampleSentences: getExampleSentences($, el, request_url),
        thematicDictionary: $(el).children(".cat").text().trim(),
        note: getNote($, el),
        refs: getRefs($, el, request_url),
      };
      return meaning;
    })
    .toArray();
}

function getMeaningGroups(
  $: CheerioAPI,
  el: BasicAcceptedElems<AnyNode> | undefined,
  request_url: string,
): IMeaningGroup[] {
  return $(el)
    .children(".partOfSpeechSectionHeader")
    .map((_, el) => {
      const meaningGroup: IMeaningGroup = {
        partOfSpeech: $(el).children(".partOfSpeech").text(),
        meanings: getMeanings($, el, request_url),
      };
      return meaningGroup;
    })
    .toArray();
}
router.addHandler("detail", async ({ $, pushData, request, log }) => {
  const dictionaryEntities = $("div .diki-results-left-column")
    .children("div")
    .children("div .dictionaryEntity");
  dictionaryEntities.each((_, el) => {
    const entity: IEntity = {
      hws: getHws($, $(el).children(".hws").get(0), request.url),
      meaningGroups: getMeaningGroups($, el, request.url),
      note: getNote($, $(el).children(".hws").get(0)),
    };
    pushData({ entity });
  });
});
