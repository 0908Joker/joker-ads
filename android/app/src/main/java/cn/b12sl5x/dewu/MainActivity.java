package cn.b12sl5x.dewu;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final int SAVE_IMAGE = 30, PICK_FILE = 31;
    private WebView web;
    private FrameLayout frame;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingImage;
    private String bridgeScript = "";

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(8, 13, 18));
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        web.setBackgroundColor(Color.rgb(8, 13, 18));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        installBridge();
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (UrlPolicy.isInternal(url)) return false;
                openExternal(url);
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                if (UrlPolicy.isMain(url) && !bridgeScript.isEmpty()) view.evaluateJavascript(bridgeScript, null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) new AlertDialog.Builder(MainActivity.this)
                        .setMessage("暂时无法连接，请检查网络后重试。")
                        .setPositiveButton("重试", (dialog, which) -> web.loadUrl(UrlPolicy.HOME))
                        .setNegativeButton("取消", null).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(params.createIntent(), PICK_FILE); }
                catch (RuntimeException ex) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen != null) { callback.onCustomViewHidden(); return; }
                fullscreen = view; fullscreenCallback = callback;
                frame.addView(view, new FrameLayout.LayoutParams(-1, -1));
                web.setVisibility(View.GONE);
            }
            @Override public void onHideCustomView() { closeFullscreen(); }
        });
        // External APK/download links use the system browser's existing download UI.
        web.setDownloadListener((url, agent, disposition, mime, size) -> openExternal(url));
        if (state == null || web.restoreState(state) == null) {
            String launch = getIntent().getDataString();
            web.loadUrl(UrlPolicy.isMain(launch) ? launch : UrlPolicy.HOME);
        }
    }

    private void installBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try (InputStream stream = getAssets().open("native-bridge.js"); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = stream.read(buffer)) != -1) bytes.write(buffer, 0, count);
            bridgeScript = bytes.toString("UTF-8");
        } catch (Exception ex) { return; }
        WebViewCompat.addWebMessageListener(web, "DewuNative", Collections.singleton("https://b12sl5x.cn"),
                (view, message, source, mainFrame, reply) -> {
                    if (!mainFrame || !UrlPolicy.isMain(source.toString())) return;
                    String data = message.getData();
                    if (data == null || data.length() > 12 * 1024 * 1024) return;
                    try {
                        JSONObject value = new JSONObject(data);
                        if ("copy".equals(value.optString("type"))) {
                            String text = value.optString("text");
                            if (text.length() > 8192) return;
                            ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("得污", text));
                        } else if ("saveImage".equals(value.optString("type"))) {
                            saveImage(value.optString("data"), value.optString("name"));
                        }
                    } catch (Exception ex) { Toast.makeText(this, "操作未完成，请重试", Toast.LENGTH_SHORT).show(); }
                });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            WebViewCompat.addDocumentStartJavaScript(web, bridgeScript, Collections.singleton("https://b12sl5x.cn"));
    }

    private void saveImage(String data, String name) {
        if (pendingImage != null || !data.startsWith("data:image/png;base64,")) return;
        byte[] bytes;
        try { bytes = Base64.decode(data.substring(data.indexOf(',') + 1), Base64.DEFAULT); }
        catch (IllegalArgumentException ex) { return; }
        if (bytes.length < 8 || bytes.length > 8 * 1024 * 1024 || bytes[0] != (byte) 137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71) return;
        pendingImage = bytes;
        String safeName = name.matches("[A-Za-z0-9_-]{1,80}\\.png") ? name : "dewu-card.png";
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("image/png").putExtra(Intent.EXTRA_TITLE, safeName);
        try { startActivityForResult(intent, SAVE_IMAGE); }
        catch (RuntimeException ex) { pendingImage = null; Toast.makeText(this, "未找到文件保存工具", Toast.LENGTH_SHORT).show(); }
    }

    private void openExternal(String url) {
        if (!UrlPolicy.isExternal(url)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (RuntimeException ex) { Toast.makeText(this, "暂无可打开此链接的应用", Toast.LENGTH_SHORT).show(); }
    }
    private void closeFullscreen() {
        if (fullscreen == null) return;
        frame.removeView(fullscreen); fullscreen = null; web.setVisibility(View.VISIBLE);
        fullscreenCallback.onCustomViewHidden(); fullscreenCallback = null;
    }
    @Override public void onBackPressed() {
        if (fullscreen != null) closeFullscreen();
        else if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle out) { web.saveState(out); super.onSaveInstanceState(out); }
    @Override protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data)); fileCallback = null;
        }
        if (request == SAVE_IMAGE) {
            byte[] bytes = pendingImage; pendingImage = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new IllegalStateException("No output stream");
                    stream.write(bytes);
                    Toast.makeText(this, "身份卡已保存", Toast.LENGTH_SHORT).show();
                } catch (Exception ex) { Toast.makeText(this, "保存失败，请重试", Toast.LENGTH_SHORT).show(); }
            }
        }
    }
}
