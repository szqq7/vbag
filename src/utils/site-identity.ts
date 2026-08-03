/** Resolved media reference from getSiteSettings() */
export interface MediaReference {
	mediaId: string;
	alt?: string;
	url?: string;
}

export interface BlogSiteIdentitySettings {
	title?: string;
	tagline?: string;
	logo?: MediaReference;
	favicon?: MediaReference;
}

const DEFAULT_SITE_TITLE = "vbags";
const DEFAULT_SITE_TAGLINE = "Thoughts on building for the web";

export function resolveBlogSiteIdentity(settings?: BlogSiteIdentitySettings) {
	return {
		// ★ vbag 站点固定使用 vbags,不读共用数据库(D1:uupack)的 title,
		//   避免数据库 UPDATE 影响 uupack 站点
		siteTitle: DEFAULT_SITE_TITLE,
		siteTagline: settings?.tagline ?? DEFAULT_SITE_TAGLINE,
		siteLogo: settings?.logo?.url ? settings.logo : null,
	};
}
