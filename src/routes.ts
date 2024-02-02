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
  recordings: IRecording[]; // TODO: is it optional?
  popularity: number;
  variety?: string;
}

interface IMeaningGroup {
  partOfSpeech: string;
  meanings: IMeaning[];
}

interface IMeaning {
  hws: string[];
  grammarTags?: string[];
  languageRegister?: string[];
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
            const additionalInformations = $(el)
              .nextAll(".dictionaryEntryHeaderAdditionalInformation")
              .first();
            let popularity = 0;
            let variety = undefined;
            additionalInformations.children().each((_, el) => {
              if ($(el).hasClass("starsForNumOccurrences"))
                popularity = $(el).text().length;
              if ($(el).hasClass("languageVariety")) variety = $(el).text();
            });
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
              popularity: popularity,
              variety: variety,
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
            const meaning: IMeaning = {
              hws: $(el)
                .find(".hw")
                .map((_, el) => $(el).text().trim())
                .toArray(),
              grammarTags: $(el)
                .find(".grammarTag")
                .map((_, el) => {
                  const t = $(el).text();
                  return t.substring(1, t.length - 1);
                })
                .toArray(),
              languageRegister: $(el)
                .find(".languageRegister")
                .map((_, el) => {
                  return $(el).text();
                })
                .toArray(),
              exampleSentences: $(el)
                .find(".exampleSentence")
                .map((_, el) => {
                  const translation = $(el)
                    .find(".exampleSentenceTranslation")
                    .first()
                    .text()
                    .trim();
                  return {
                    sentence: $(el)
                      .contents()
                      .filter(function () {
                        return this.nodeType == 3;
                      })
                      .text()
                      .trim(),
                    translation: translation.substring(
                      1,
                      translation.length - 1,
                    ),
                    recordings: getRecordings($, el, request.url),
                  };
                })
                .toArray(),
               thematicDictionary: $(el).find(".cat").text().trim()
            };
            meaningGroup.meanings.push(meaning);
          });
        entity.meaningGroups.push(meaningGroup);
      });
    pushData({ entity });
  });
});
