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

router.addHandler("detail", async ({ $, pushData, request, log }) => {
  const dictionaryEntities = $("div .diki-results-left-column")
    .children("div")
    .children("div .dictionaryEntity");
  dictionaryEntities.each((_, el) => {
    const entity: IEntity = {
      hws: [],
      meaningGroups: [],
      note: getNote($, $(el).children(".hws").get(0)),
    };
    $(el)
      .children(".hws")
      .children("h1")
      .each((_, el) => {
        $(el)
          .children(".hw")
          .each((_, el) => {
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
              recordings: getRecordings(
                $,
                recordingsAndTranscriptions,
                request.url,
              ),
              additionalInformation: getAdditionalInformation(
                $,
                additionalInformation,
              ),
              lessPopular: $(el).hasClass("hwLessPopularAlternative"),
            };
            entity.hws.push(hw);
          });
      });
    $(el)
      .children(".partOfSpeechSectionHeader")
      .each((_, el) => {
        const meaningGroup: IMeaningGroup = {
          partOfSpeech: $(el).children(".partOfSpeech").text(),
          meanings: [],
        };
        $(el)
          .nextAll(".foreignToNativeMeanings")
          .children("li")
          .each((_, el) => {
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
              exampleSentences: $(el)
                .children(".exampleSentence")
                .map((_, el) => {
                  const translation = $(el)
                    .children(".exampleSentenceTranslation")
                    .text()
                    .trim();
                  const recordings = $(el)
                    .children(".recordingsAndTranscriptions")
                    .get(0);
                  return {
                    sentence: getTextNodes($, el),
                    translation: removeBrackets(translation),
                    recordings: getRecordings($, recordings, request.url),
                  };
                })
                .toArray(),
              thematicDictionary: $(el).children(".cat").text().trim(),
              note: getNote($, el),
              refs: $(el)
                .children(".ref")
                .children("div")
                .children("a")
                .map((_, el) => {
                  const recordings = $(el)
                    .nextAll(".recordingsAndTranscriptions")
                    .get(0);
                  return {
                    word: $(el).text(),
                    type: getTextNodes($, $(el).parent().get(0)).split(":")[0],
                    recordings: getRecordings($, recordings, request.url),
                  };
                })
                .toArray(),
            };

            meaningGroup.meanings.push(meaning);
          });
        entity.meaningGroups.push(meaningGroup);
      });
    pushData({ entity });
  });
});
