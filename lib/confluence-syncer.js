/**
 * @module confluence-syncer
 */
import context from './context.js';
import config from './config.js';
import logger from './logger.js';
import ConfluenceSDK from './confluence-sdk.js';
import { Meta, LocalPage } from '../lib/models/index.js';
import AssetRenderer from './renderers/asset-renderer.js';

const confluence = new ConfluenceSDK(config.confluence);

/**
 * Sync local markdown documentation with Confluence
 * 
 * @returns {Promise<void>}
 */
async function sync() {
    try {
        const { siteName, repo, pages: localPages, readMe, pageRefs, sectionHierarchy } = context.getContext();
        const assetRenderer = new AssetRenderer(config, pageRefs);
        const home = await syncHome(repo, siteName, readMe, assetRenderer);
        await syncPages(home, localPages, sectionHierarchy, assetRenderer);
        const rootUrl = `${config.confluence.host}/wiki/spaces/${config.confluence.spaceKey}/pages/${home}`;
        logger.info(`"${siteName}" Documentation published at ${rootUrl}`);
        syncSummary(siteName, rootUrl);
    } catch (error) {
        errorHandler(error);
    }
}

/**
 * Write action summary
 * 
 * @param {string} siteName - The name of the documentation site
 * @param {string} url - The Confluence url of the published documentation
 */
function syncSummary(siteName, url) {
    logger.summary.addHeading(':books: Documentation published', 1)
        .addRaw('View the documentation using the following link')
        .addBreak().addRaw(':link: ')
        .addLink(siteName, url).addEOL()
        .write();
}

/**
 * Handles errors and fails the action
 *  
 * @param {Error} error - The Error that occurred
 */
function errorHandler(error) {
    if (logger.isDebug()) {
        const safeConfig = Object.assign({}, config);
        safeConfig.confluence.token = '***';
        logger.debug(`Config:\n${JSON.stringify(safeConfig, null, 2)}`);
        logger.debug(error.stack);
    }
    logger.fail(error);
}

/**
 * Create or update home page from README.md
 * 
 * @param {string} repo 
 * @param {string} siteName 
 * @param {LocalPage} localPage 
 * @param {AssetRenderer} renderer 
 * @returns {Promise<number>} Home page id
 */
async function syncHome(repo, siteName, localPage, renderer) {
    if (!localPage) {
        localPage = new LocalPage(siteName, new Meta(repo));
        localPage.html = `<h1>${siteName}</h1>`;
    }
    localPage.parentPageId = await findParentPage();
    let homePage = localPage;
    const remotePage = await confluence.findPage(siteName);
    if (remotePage) {
        homePage = remotePage;
        homePage.localPage = localPage;
        // check for potential repo conflict
        if (homePage.repoConflict()) {
            throw new Error(`Page "${siteName}" already exist for another repo "${homePage.meta.repo}"`);
        }
    }
    return homePage.sync(renderer, confluence).then(page => page.id);
}

/**
 * Find the `id` of the Confluence page Configured to be the parent for our documents
 * 
 * @returns {number} The `id` of the configured parent page
 * @throws `Error` if the configured parent page does not exist
 */
async function findParentPage() {
    const title = config.confluence.parentPage;
    if (!title) {
        return;
    }
    const parentPage = await confluence.findPage(title);
    if (!parentPage) {
        throw new Error(`The page configured as parent (${title}) does not exist in confluence`);
    }
    return parentPage.id;
}

/**
 * Sync Local pages with Confluence
 * 
 * @param {number} home - The id of the home page 
 * @param {Array<LocalPage>} localPages - Array of pages
 * @param {object} sectionHierarchy - Maps section names to their parent section names
 * @param {AssetRenderer} renderer - `AssetRenderer` instance 
 */
async function syncPages(home, localPages, sectionHierarchy, renderer) {
    // Map to track synced page IDs
    // For sections, we store the ID of the section's index/README page
    const syncedPages = new Map();
    syncedPages.set(null, home); // root level pages use home as parent
    
    // Group pages by their parent section name
    const pagesByParent = new Map();
    
    for (const page of localPages) {
        const parentKey = page.parentPath || null;
        if (!pagesByParent.has(parentKey)) {
            pagesByParent.set(parentKey, []);
        }
        pagesByParent.get(parentKey).push(page);
    }
    
    // --- Section Index Promotion ---
    // For each section whose children include an index.md or README.md,
    // promote that page to the parent level. It will serve as the Confluence
    // parent page for the section's remaining children, preventing
    // cross-deletion when multiple sections share the same parent.
    const promotedSections = new Map(); // meta.path → sectionName
    
    for (const [sectionName, parentSection] of Object.entries(sectionHierarchy)) {
        const sectionPages = pagesByParent.get(sectionName);
        if (!sectionPages) continue;
        
        const indexIdx = sectionPages.findIndex(p => {
            const metaPath = p.meta?.path || '';
            return metaPath.endsWith('/index.md') || metaPath.endsWith('/README.md');
        });
        
        if (indexIdx >= 0) {
            const [indexPage] = sectionPages.splice(indexIdx, 1);
            const parentKey = parentSection || null;
            if (!pagesByParent.has(parentKey)) {
                pagesByParent.set(parentKey, []);
            }
            pagesByParent.get(parentKey).push(indexPage);
            indexPage.parentPath = parentSection;
            promotedSections.set(indexPage.meta.path, sectionName);
        }
    }
    
    // Recursively sync pages level by level
    const processLevel = async (sectionName) => {
        const pages = pagesByParent.get(sectionName) || [];
        
        // Determine the parent page ID for this level
        let parentPageId;
        let hasDedicatedParent;
        
        if (sectionName === null) {
            parentPageId = home;
            hasDedicatedParent = true;
        } else {
            // Try the section's own dedicated page first (set by promotion)
            parentPageId = syncedPages.get(sectionName);
            hasDedicatedParent = !!parentPageId;
            if (!parentPageId) {
                // Fallback: use the enclosing section's page
                const parentSection = sectionHierarchy[sectionName] || null;
                parentPageId = syncedPages.get(parentSection);
            }
        }
        
        if (!parentPageId) return;
        
        // Fetch remote children for matching and orphan detection.
        // When this level shares a parent with sibling sections
        // (hasDedicatedParent=false), we still fetch for matching but
        // skip orphan deletion to prevent cross-section deletion.
        const remotePages = await confluence.getChildPages(parentPageId);
        
        // If no local pages and no remote pages, nothing to do
        if (pages.length === 0 && remotePages.size === 0) return;
        
        const union = [];
        
        for (let localPage of pages) {
            localPage.parentPageId = parentPageId;
            const remotePage = remotePages.get(localPage.meta.path);
            if (!remotePage) {
                union.push(localPage);
                continue;
            }
            remotePages.delete(localPage.meta.path);
            remotePage.localPage = localPage;
            union.push(remotePage);
        }
        
        // Only delete orphan remote pages when this level has its own
        // dedicated parent. Otherwise we'd cross-delete pages from
        // sibling sections that share the same Confluence parent.
        if (hasDedicatedParent) {
            for (let remotePage of remotePages.values()) {
                union.push(remotePage);
            }
        }
        
        // Sort pages to prioritize README.md / index.md first
        union.sort((a, b) => {
            const aPath = a.meta?.path || '';
            const bPath = b.meta?.path || '';
            const aIsIndex = aPath.endsWith('README.md') || aPath.endsWith('/index.md');
            const bIsIndex = bPath.endsWith('README.md') || bPath.endsWith('/index.md');
            if (aIsIndex && !bIsIndex) return -1;
            if (!aIsIndex && bIsIndex) return 1;
            return 0;
        });
        
        // Sync all pages at this level
        for (let i = 0; i < union.length; i++) {
            const page = union[i];
            const syncedPage = await page.sync(renderer, confluence);
            
            if (syncedPage && syncedPage.id) {
                // Detect promoted section pages and store their IDs so
                // child sections can use them as Confluence parents
                const pagePath = page.localPage?.meta?.path || page.meta?.path || '';
                const promotedSection = promotedSections.get(pagePath);
                if (promotedSection) {
                    syncedPages.set(promotedSection, syncedPage.id);
                }
                
                // For section levels without a promoted page, the first
                // synced page becomes the section parent for child sections
                if (i === 0 && sectionName !== null && !syncedPages.has(sectionName)) {
                    syncedPages.set(sectionName, syncedPage.id);
                }
            }
        }
        
        // After syncing this section, find and process all child sections
        const childSections = [];
        for (let [childSection, parentOfChild] of Object.entries(sectionHierarchy)) {
            if (parentOfChild === sectionName) {
                childSections.push(childSection);
            }
        }
        
        for (let childSection of childSections) {
            await processLevel(childSection);
        }
    };
    
    // Start processing from root level (null = no parent section)
    await processLevel(null);
}

/**
 * 
 * @param {Iterable<RemotePage>} remotePages 
 */
async function unpublish(remotePages) {
    for (let page of remotePages) {
        await confluence.deletePage(page.id).then(() => {
            logger.debug(`Deleted Page: [${page.id}] ${page.title}`);
        });
    }
}

/**
 * Cleanup all pages from confluence
 * 
 * @returns {Promise<void>}
 */
async function cleanup() {
    const { siteName } = await context.getContext();
    try {
        const home = await confluence.findPage(siteName);
        if (!home) {
            logger.warn(`No page with title "${siteName}" found in confluence, nothing to clean here`);
            return;
        }
        const remotePages = await confluence.getChildPages(home.id);
        // Delete all children
        await unpublish(remotePages.values());
        // Delete home
        await unpublish([home]);
        cleanupSummary(siteName);
    } catch (error) {
        errorHandler(error);
    }
}

/**
 * Write action summary after cleanup
 * 
 * @param {string} siteName - The site name 
 */
function cleanupSummary(siteName) {
    logger.summary.addHeading(':broom: Cleanup', 1)
        .addRaw(`All confluence pages of "${siteName}" have been deleted`).addEOL()
        .write();
}

export { sync, cleanup };
