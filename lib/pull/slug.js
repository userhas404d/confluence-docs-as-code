/**
 * @module pull/slug
 * @description Converts page titles to kebab-case filename slugs for MkDocs.
 */

/**
 * Convert a page title to a kebab-case filename slug.
 *
 * Rules:
 * 1. Convert to lowercase
 * 2. Replace spaces with hyphens
 * 3. Remove non-alphanumeric characters (except hyphens)
 * 4. Collapse consecutive hyphens
 * 5. Trim leading/trailing hyphens
 *
 * @param {string} title - Page title
 * @returns {string} Kebab-case slug (without .md extension)
 */
export function slugify(title) {
    return title
        .toLowerCase()
        .replace(/[\s\u2014\u2013]+/g, '-')   // spaces, em/en dashes → hyphens
        .replace(/[^a-z0-9-]/g, '')            // remove non-alphanumeric (except hyphens)
        .replace(/-{2,}/g, '-')                // collapse consecutive hyphens
        .replace(/^-+|-+$/g, '');              // trim leading/trailing hyphens
}

/**
 * Resolve a slug against a set of already-used slugs, appending a numeric
 * suffix if a collision is detected.
 *
 * @param {string} slug - The candidate slug
 * @param {Set<string>} usedSlugs - Set of slugs already in use
 * @returns {string} A unique slug (possibly with -2, -3, etc. suffix)
 */
export function resolveSlug(slug, usedSlugs) {
    if (!usedSlugs.has(slug)) {
        usedSlugs.add(slug);
        return slug;
    }
    let counter = 2;
    while (usedSlugs.has(`${slug}-${counter}`)) {
        counter++;
    }
    const resolved = `${slug}-${counter}`;
    usedSlugs.add(resolved);
    return resolved;
}
