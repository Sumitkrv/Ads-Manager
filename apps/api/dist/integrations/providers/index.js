import { GoogleAdsProvider } from "./google-ads.js";
import { MetaAdsProvider } from "./meta-ads.js";
export function createAdvertisingProviders(apiConfig, fetcher) {
    return {
        google_ads: new GoogleAdsProvider({
            clientId: apiConfig.GOOGLE_ADS_CLIENT_ID,
            clientSecret: apiConfig.GOOGLE_ADS_CLIENT_SECRET,
            developerToken: apiConfig.GOOGLE_ADS_DEVELOPER_TOKEN,
            redirectUri: apiConfig.GOOGLE_ADS_REDIRECT_URI,
            apiVersion: apiConfig.GOOGLE_ADS_API_VERSION,
        }, fetcher),
        meta_ads: new MetaAdsProvider({
            appId: apiConfig.META_APP_ID,
            appSecret: apiConfig.META_APP_SECRET,
            redirectUri: apiConfig.META_REDIRECT_URI,
            graphApiVersion: apiConfig.META_GRAPH_API_VERSION,
            loginConfigId: apiConfig.META_LOGIN_CONFIG_ID,
        }, fetcher),
    };
}
export { ProviderError } from "./types.js";
