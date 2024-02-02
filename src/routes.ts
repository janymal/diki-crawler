import { createCheerioRouter } from "crawlee";
import url from "url";
// const cheerio = require("cheerio");
import { CheerioAPI, BasicAcceptedElems, AnyNode } from "cheerio";

export const router = createCheerioRouter();

interface IEntity {
  hws: IHw[];
  meaningGroups: IMeaningGroup[];
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
}

interface IMeaning {
  hws: string[];
  additionalInformation: IAdditionalInformation;
  grammarTags?: string[];
  exampleSentences: IExampleSentence[];
  thematicDictionary?: string;
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
    ?.find(".hasRecording")
    .map((_, el) => {
      return {
        lang: $(el).attr("class")?.split(" ")[0]!,
        url: url.resolve(
          request_url,
          $(el).find(".soundOnClick").first().attr("data-audio-url")!,
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
  };
}

function removeBrackets(str: string): string {
  return str.substring(1, str.length - 1);
}

function getTextNodes(
  $: CheerioAPI,
  element: BasicAcceptedElems<AnyNode>,
): string {
  return $(element)
    .contents()
    .filter(function () {
      return this.nodeType == 3;
    })
    .text();
}

router.addHandler("detail", async ({ $, pushData, request, log }) => {
  const dictionaryEntities = $("div .diki-results-left-column").find(
    "div .dictionaryEntity",
  );
  dictionaryEntities.each((_, el) => {
    const entity: IEntity = {
      hws: [],
      meaningGroups: [],
    };
    $(el)
      .find("h1")
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
                ?.find(".phoneticTranscription")
                .first()
                .find("img")
                .first()
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
          partOfSpeech: $(el).find(".partOfSpeech").first().text(),
          meanings: [],
        };
        $(el)
          .nextAll(".foreignToNativeMeanings")
          .first()
          .children("li")
          .each((_, el) => {
            const additionalInformation = $(el)
              .find(".meaningAdditionalInformation")
              .get(0);
            const meaning: IMeaning = {
              hws: $(el)
                .find(".hw")
                .map((_, el) => $(el).text().trim())
                .toArray(),
              grammarTags: $(el)
                .find(".grammarTag")
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
                .find(".exampleSentence")
                .map((_, el) => {
                  const translation = $(el)
                    .find(".exampleSentenceTranslation")
                    .first()
                    .text()
                    .trim();
                  return {
                    sentence: getTextNodes($, el).trim(),
                    translation: removeBrackets(translation),
                    recordings: getRecordings($, el, request.url),
                  };
                })
                .toArray(),
              thematicDictionary: $(el).find(".cat").text().trim(),
            };
            meaningGroup.meanings.push(meaning);
          });
        entity.meaningGroups.push(meaningGroup);
      });
    pushData({ entity });
  });
});
