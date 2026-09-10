import type { KommoClient, RequestOptions } from "./client.js";

interface Page<T> {
  _embedded?: Record<string, T[]>;
  _links?: { next?: { href: string } };
}

/**
 * Collect every item of a paginated Kommo collection.
 * Stops on 204 (empty), a short page, or a missing `next` link.
 */
export async function collectAll<T>(
  client: KommoClient,
  path: string,
  embeddedKey: string,
  query: RequestOptions["query"] = {},
  pageSize = 250,
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await client.get<Page<T> | null>(path, {
      query: { ...query, page, limit: pageSize },
    });
    const items = res?._embedded?.[embeddedKey];
    if (!items || items.length === 0) break;
    out.push(...items);
    if (items.length < pageSize || !res?._links?.next) break;
    page += 1;
  }
  return out;
}
