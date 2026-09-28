package cn.b12sl5x.dewu;

import java.net.URI;

final class UrlPolicy {
    static final String HOME = "https://b12sl5x.cn/#/appcenter";
    static boolean isMain(String value) {
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && "b12sl5x.cn".equalsIgnoreCase(uri.getHost())
                    && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null;
        } catch (RuntimeException e) { return false; }
    }
    static boolean isInternal(String value) {
        if (isMain(value)) return true;
        try {
            URI uri = URI.create(value);
            return "http".equalsIgnoreCase(uri.getScheme()) && "okqpkdj.cn".equalsIgnoreCase(uri.getHost())
                    && (uri.getPort() == -1 || uri.getPort() == 80) && uri.getUserInfo() == null;
        } catch (RuntimeException e) { return false; }
    }
    static boolean isExternal(String value) {
        try {
            String scheme = URI.create(value).getScheme();
            return "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)
                    || "tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme)
                    || "tg".equalsIgnoreCase(scheme);
        } catch (RuntimeException e) { return false; }
    }
}
