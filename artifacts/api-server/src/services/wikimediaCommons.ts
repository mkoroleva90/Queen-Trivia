const WIKIMEDIA_COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIMEDIA_USER_AGENT =
    "TriviaNightApp/1.0 (safe Wikimedia Commons image sourcing; contact: support@queentrivia.app)";
const SEARCH_RESULT_LIMIT = 8;
const LOOKUP_TIMEOUT_MS = 5000;
const THUMBNAIL_WIDTH = 1000;

export interface WikimediaImageAttribution {
    creditLine: string;
    licenseName: string;
}

export interface WikimediaImage {
    thumbnailUrl: string;
    licenseName: string;
    attribution: WikimediaImageAttribution | null;
}

interface CommonsMetadataValue {
    value?: unknown;
}

interface CommonsImageInfo {
    thumburl?: unknown;
    mime?: unknown;
    extmetadata?: Record<string, CommonsMetadataValue>;
}

interface CommonsPage {
    title?: unknown;
    categories?: Array<{ title?: unknown }>;
    imageinfo?: CommonsImageInfo[];
}

interface CommonsSearchResponse {
    query?: {
        pages?: CommonsPage[];
    };
}

const UNSAFE_IMAGE_TERMS = [
    "adult", "porn", "pornography", "xxx", "erotic", "sexual", "nudity", "nude",
    "naked", "genital", "penis", "vagina", "breast", "masturbation",
    "gore", "gory", "graphic violence", "graphic injury", "blood", "bloody",
    "corpse", "dead body", "autopsy", "mutilation", "dismemberment", "decapitation",
    "execution", "torture", "wound", "open wound", "surgery", "surgical",
    "medical gore", "war crime", "massacre", "suicide", "self harm",
];

function plainText(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&quot;/gi, "\"")
        .replace(/\s+/g, " ")
        .trim();
}

function metadataValue(metadata: Record<string, CommonsMetadataValue> | undefined, key: string): string {
    return plainText(metadata?.[key]?.value);
}

function isUnsafeImageCandidate(page: CommonsPage, imageInfo: CommonsImageInfo): boolean {
    const metadata = imageInfo.extmetadata;
    const title = plainText(page.title);
    const description = metadataValue(metadata, "ImageDescription");
    const categories = (page.categories ?? []).map((category) => plainText(category.title)).join(" ");
    const searchableText = `${title} ${description} ${categories}`.toLocaleLowerCase();
    return UNSAFE_IMAGE_TERMS.some((term) => {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-z])${escapedTerm}($|[^a-z])`, "i").test(searchableText);
    });
}

function isPublicDomainOrCc0(licenseName: string): boolean {
    const normalized = licenseName.toLocaleLowerCase();
    return normalized.includes("public domain")
        || normalized.includes("cc0")
        || normalized.includes("cc zero")
        || /\bpd(?:[-\s]|$)/.test(normalized);
}

function isAttributionCreativeCommonsLicense(licenseName: string): boolean {
    const normalized = licenseName.toLocaleLowerCase();
    if (normalized.includes("noncommercial") || /\bcc[-\s]?by[-\s]?nc/.test(normalized)) return false;
    return normalized.includes("creative commons attribution")
        || /\bcc[-\s]?by(?:[-\s]|$)/.test(normalized);
}

function getLicenseName(metadata: Record<string, CommonsMetadataValue> | undefined): string {
    return metadataValue(metadata, "LicenseShortName")
        || metadataValue(metadata, "UsageTerms")
        || metadataValue(metadata, "License");
}

function getCreditLine(metadata: Record<string, CommonsMetadataValue> | undefined): string {
    const creditLine = metadataValue(metadata, "Credit") || metadataValue(metadata, "Artist");
    return /^(unknown|unknown author|n\/a)$/i.test(creditLine) ? "" : creditLine;
}

/**
 * Finds a safe, appropriately licensed Commons thumbnail for a concrete visual subject.
 * It intentionally returns a scaled thumbnail rather than the source original.
 */
export async function lookupWikimediaImage(searchSubject: string): Promise<WikimediaImage | null> {
    const url = new URL(WIKIMEDIA_COMMONS_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", searchSubject);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", String(SEARCH_RESULT_LIMIT));
    url.searchParams.set("prop", "imageinfo|categories");
    url.searchParams.set("iiprop", "url|mime|extmetadata");
    url.searchParams.set("iiurlwidth", String(THUMBNAIL_WIDTH));
    url.searchParams.set("cllimit", "max");

    let payload: CommonsSearchResponse;
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": WIKIMEDIA_USER_AGENT,
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
        });
        if (!response.ok) return null;
        payload = await response.json() as CommonsSearchResponse;
    } catch {
        return null;
    }

    const pages = payload.query?.pages ?? [];
    for (const page of pages.slice(0, SEARCH_RESULT_LIMIT)) {
        const imageInfo = page.imageinfo?.[0];
        if (!imageInfo || isUnsafeImageCandidate(page, imageInfo)) continue;

        const mime = typeof imageInfo.mime === "string" ? imageInfo.mime.toLocaleLowerCase() : "";
        if (mime !== "image/jpeg" && mime !== "image/png") continue;

        const thumbnailUrl = typeof imageInfo.thumburl === "string" ? imageInfo.thumburl : "";
        if (!thumbnailUrl) continue;

        const licenseName = getLicenseName(imageInfo.extmetadata);
        if (!licenseName) continue;

        if (isPublicDomainOrCc0(licenseName)) {
            return { thumbnailUrl, licenseName, attribution: null };
        }

        const creditLine = getCreditLine(imageInfo.extmetadata);
        if (isAttributionCreativeCommonsLicense(licenseName) && creditLine) {
            return {
                thumbnailUrl,
                licenseName,
                attribution: { creditLine, licenseName },
            };
        }
    }

    return null;
}