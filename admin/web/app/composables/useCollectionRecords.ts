export function useCollectionRecords() {
  const { api } = useApi();

  // The API caps pageSize at 500, so collections bigger than that (e.g. ~1600 stops)
  // need multiple pages to fetch in full.
  async function fetchAllRecords<T>(collection: string): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    while (true) {
      const res = await api<{ records: { data: T }[]; total: number; pageSize: number }>(
        `/api/collections/${collection}/records?page=${page}&pageSize=500`,
      );
      all.push(...res.records.map((r) => r.data));
      if (all.length >= res.total) break;
      page += 1;
    }
    return all;
  }

  return { fetchAllRecords };
}
