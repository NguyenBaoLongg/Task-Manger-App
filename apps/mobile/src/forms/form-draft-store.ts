type Draft = { formVersionId: string; values: Record<string, unknown> };
export const createFormDraftStore = () => {
  const drafts = new Map<string, Draft>();
  return {
    save: (draft: Draft) => drafts.set(draft.formVersionId, draft),
    load: (formVersionId: string) => drafts.get(formVersionId),
    evict: (formVersionId: string) => drafts.delete(formVersionId),
    clear: () => drafts.clear(),
  };
};
