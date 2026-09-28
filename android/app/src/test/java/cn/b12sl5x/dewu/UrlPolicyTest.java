package cn.b12sl5x.dewu;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    @Test public void onlyExactProductionOriginsAreInternal() {
        assertTrue(UrlPolicy.isMain(UrlPolicy.HOME));
        assertTrue(UrlPolicy.isInternal("http://okqpkdj.cn/?inviteCode=a%2Bb"));
        assertTrue(UrlPolicy.isMain("https://b12sl5x.cn:443/#/my"));
        for (String url : new String[]{null, "", "https://b12sl5x.cn.attacker.test", "https://user@b12sl5x.cn", "https://b12sl5x.cn:444", "http://b12sl5x.cn", "file:///data/local", "javascript:alert(1)", "https://app.b12sl5x.cn"}) {
            assertFalse(String.valueOf(url), UrlPolicy.isInternal(url));
        }
    }
    @Test public void dangerousIntentsNeverLeaveTheApp() {
        assertFalse(UrlPolicy.isExternal("intent://x/#Intent;component=private;end"));
        assertFalse(UrlPolicy.isExternal("file:///sdcard/private"));
        assertFalse(UrlPolicy.isExternal("javascript:alert(1)"));
        assertTrue(UrlPolicy.isExternal("https://example.com/download.apk"));
        assertTrue(UrlPolicy.isExternal("tg://resolve?domain=example"));
    }
}
