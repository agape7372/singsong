export type CatalogTrack = {
  id: string;
  title: string;
  artist: string;
  karaokeCodes: Partial<Record<"TJ" | "KY", string>>;
  source: "fixture" | "licensed";
};

export interface CatalogProvider {
  readonly kind: "fixture" | "licensed";
  search(query: string, limit?: number): Promise<CatalogTrack[]>;
}
