export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

export function createCatalogUrl(slug: string) {
    if (!slug) return '';
    return `${window.location.origin}/catalogo/${encodeURIComponent(slug)}`;
}
