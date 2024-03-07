import type { AnyNode, Cheerio, CheerioAPI } from "cheerio";
import { URL } from "node:url";
import type { Context } from "../shared-types.js";
import { arrayPushSafely } from "../utils.js";
import { PropertiesValidator } from "../validator.js";
import type { DictionaryEntity } from "./dictionary-entity.js";
import { Recording } from "./recording.js";

export class RecordingsAndTranscriptions {
    constructor(
        readonly recordings?: Recording[],
        readonly transcriptions?: URL[],
    ) {}
    static parse(
        $: CheerioAPI,
        context: Context<DictionaryEntity>,
        recordingsAndTranscriptions: Cheerio<AnyNode>,
    ): RecordingsAndTranscriptions | undefined {
        const validator = new PropertiesValidator<RecordingsAndTranscriptions>(
            RecordingsAndTranscriptions.name,
        );
        recordingsAndTranscriptions.children().each((_, childElement) => {
            const child = $(childElement);
            if (child.hasClass("hasRecording")) {
                arrayPushSafely(
                    validator.optional,
                    "recordings",
                    Recording.parse($, context, child),
                );
            } else if (child.hasClass("phoneticTranscription")) {
                const url = child.children("a").children("img").attr("src");
                arrayPushSafely(
                    validator.optional,
                    "transcriptions",
                    new URL(url ?? ""),
                );
            }
        });
        return validator.validate();
    }
}
