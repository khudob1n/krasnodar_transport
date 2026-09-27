export type CollectionInfo = { key: string; label: string; single: boolean; recordCount: number };
export type CollectionGroup = { namespace: string; label: string; items: CollectionInfo[] };

const NAMESPACE_LABELS: Record<string, string> = {
  ground_transport: 'Наземный транспорт',
  metro: 'Метро',
};

export function useCollections() {
  const { api } = useApi();
  const collections = useState<CollectionInfo[]>('collections:list', () => []);
  const loaded = useState<boolean>('collections:loaded', () => false);

  async function load() {
    const res = await api<{ collections: CollectionInfo[] }>('/api/collections');
    collections.value = res.collections;
    loaded.value = true;
  }

  const groups = computed<CollectionGroup[]>(() => {
    const byNamespace = new Map<string, CollectionInfo[]>();
    for (const c of collections.value) {
      const namespace = c.key.split('/')[0];
      if (!byNamespace.has(namespace)) byNamespace.set(namespace, []);
      byNamespace.get(namespace)!.push(c);
    }
    return Array.from(byNamespace.entries()).map(([namespace, items]) => ({
      namespace,
      label: NAMESPACE_LABELS[namespace] || namespace,
      items,
    }));
  });

  return { collections, groups, loaded, load };
}
