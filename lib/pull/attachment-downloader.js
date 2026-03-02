/**
 * @module pull/attachment-downloader
 * @description Downloads image attachments from Confluence pages and builds
 * an attachmentMap for ADF media node resolution.
 * Supports caching — skips downloads when the file already exists on disk.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Image media types eligible for download.
 * @type {Set<string>}
 */
const IMAGE_MEDIA_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'image/webp'
]);

/**
 * Download image attachments for a Confluence page.
 * When skipExisting is true, files that already exist on disk are skipped.
 *
 * @param {object} sdk - ConfluenceSdk instance with getAttachments() and downloadAttachment()
 * @param {string} pageId - Confluence page ID
 * @param {string} pageSlug - Page slug for filename prefixing
 * @param {string} imagesDir - Absolute path to images output directory
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.skipExisting=false] - Skip download if file already exists
 * @returns {Promise<{attachmentMap: Map<string,string>, downloadCount: number, skippedCount: number, warnings: string[]}>}
 */
export async function downloadPageAttachments(sdk, pageId, pageSlug, imagesDir, options = {}) {
    const { skipExisting = false } = options;
    const attachmentMap = new Map();
    const warnings = [];
    let downloadCount = 0;
    let skippedCount = 0;

    const attachments = await sdk.getAttachments(pageId);

    // Filter to image types only
    const imageAttachments = attachments.filter(att => IMAGE_MEDIA_TYPES.has(att.mediaType));

    for (const att of imageAttachments) {
        const localFilename = `${pageSlug}-${att.title}`;
        const localPath = `images/${localFilename}`;
        const destPath = path.join(imagesDir, localFilename);
        const rawDownloadUrl = att._links?.download || att.downloadLink;
        // The v2 API returns paths like /download/attachments/...
        // but the actual endpoint lives under /wiki/download/attachments/...
        const downloadUrl = rawDownloadUrl && !rawDownloadUrl.startsWith('/wiki')
            ? `/wiki${rawDownloadUrl}`
            : rawDownloadUrl;

        try {
            // Skip download if file already exists on disk and caching is enabled
            if (skipExisting && fs.existsSync(destPath)) {
                attachmentMap.set(att.fileId, localPath);
                skippedCount++;
                continue;
            }
            await sdk.downloadAttachment(downloadUrl, destPath);
            attachmentMap.set(att.fileId, localPath);
            downloadCount++;
        } catch (err) {
            warnings.push(`Failed to download ${att.title}: ${err.message}`);
        }
    }

    return { attachmentMap, downloadCount, skippedCount, warnings };
}
