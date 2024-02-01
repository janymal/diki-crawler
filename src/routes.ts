import { createCheerioRouter } from "crawlee";
import url from "url";

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
  exampleSentences: IExampleSentences[];
}

interface IExampleSentences {
  sentence: string;
  translation: string;
}

router.addHandler("detail", async ({ $, pushData, request, log }) => {
  const dictionaryEntities = $("div .diki-results-left-column").find("div .dictionaryEntity");
  dictionaryEntities.each((_, el) => {
    const entity: IEntity = {
      hws: [],
      meaningGroups: []
    };
    $(el).find("h1").each((_, el) => {
      $(el).children(".hw").each((_, el) => {
        const recordingAndTranscriptions = $(el).nextAll(".recordingsAndTranscriptions").first();
        const additionalInformations = $(el).nextAll(".dictionaryEntryHeaderAdditionalInformation").first();
        let popularity = 0;
        let variety = undefined;
        additionalInformations.children().each((_, el) => {
          if ($(el).hasClass("starsForNumOccurrences"))
            popularity = $(el).text().length;
          if ($(el).hasClass("languageVariety"))
            variety = $(el).text();
        });
        const recordings = recordingAndTranscriptions?.find(".hasRecording").map((_, el) => {
          const r: IRecording = {
            lang: $(el).attr("class")?.split(" ")[0]!,
            url: url.resolve(request.url, $(el).find(".soundOnClick").first().attr("data-audio-url")!),
          };
          return r;
        }).toArray();
        const hw: IHw = {
          title: $(el).text().trim(),
          transcription: recordingAndTranscriptions?.find(".phoneticTranscription").first().find("img").first().attr(
            "src",
          ),
          recordings: recordings ? recordings : [],
          popularity: popularity,
          variety: variety
        };
        entity.hws.push(hw);
      });
    });
    $(el).children(".partOfSpeechSectionHeader").each((_, el) => {
      const meaningGroup: IMeaningGroup = {
        partOfSpeech: $(el).find(".partOfSpeech").first().text(),
        meanings: []
      }
      $(el).nextAll(".foreignToNativeMeanings").first().children("li").each((_, el) => {
        const meaning: IMeaning = {
          hws: $(el).find(".hw").map((_, el) => $(el).text().trim()).toArray(),
          exampleSentences: $(el).find(".exampleSentence").map((_, el) => {
            const translation = $(el).find(".exampleSentenceTranslation").first().text().trim();
            return {
              sentence: $(el).contents().filter(function() { return this.nodeType == 3;}).text().trim(),
              translation: translation.substring(1, translation.length - 1)
            }
          }).toArray()
        }
        meaningGroup.meanings.push(meaning);
      });
      entity.meaningGroups.push(meaningGroup);
    });
    pushData({ entity });
  });
});
