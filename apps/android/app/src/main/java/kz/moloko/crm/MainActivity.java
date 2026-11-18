package kz.moloko.crm;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Moloko CRM: a full-screen shell around the studio admin panel. The client booking widget is never opened here. */
public class MainActivity extends Activity {
    static final String HOST = "moloko-art-silk.vercel.app";
    static final String START = "https://" + HOST + "/studio";
    static final String CHANNEL = "moloko";
    static final int FILE_REQ = 7, NOTIF_REQ = 8;
    static final String LATEST = "https://erztkmhaehqpgqgfwjsh.supabase.co/storage/v1/object/public/moloko-apps/latest.json";
    static final long CHECK_EVERY = 3 * 3600_000L;

    WebView web;
    ValueCallback<Uri[]> fileCallback;
    WebView printView; // kept alive until the print job is spooled
    int notifId = 100;
    long lastCheck = 0;
    String pendingUpdate; // APK url waiting for the "install unknown apps" permission
    boolean downloading = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#12100E"));
        w.setNavigationBarColor(Color.parseColor("#12100E"));

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " MolokoCRM/Android");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setBackgroundColor(Color.parseColor("#12100E"));
        web.addJavascriptInterface(new Bridge(), "MolokoNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (isStudio(u)) return false;
                openOutside(u);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try { startActivityForResult(params.createIntent(), FILE_REQ); }
                catch (ActivityNotFoundException e) { fileCallback = null; return false; }
                return true;
            }
        });

        createChannel();
        if (state != null) web.restoreState(state); else web.loadUrl(START);
        openFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); openFromIntent(intent); }

    /** A tap on a notification carries the screen to open (a booking or a page) */
    void openFromIntent(Intent i) {
        String path = i == null ? null : i.getStringExtra("path");
        if (path == null || path.isEmpty()) return;
        i.removeExtra("path");
        js("(function f(n){if(window.__molokoOpen)window.__molokoOpen(" + JSONObject.quote(path) + ");else if(n<60)setTimeout(function(){f(n+1)},250)})(0)");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingUpdate != null && canInstall()) { String u = pendingUpdate; pendingUpdate = null; download(u); }
        else if (System.currentTimeMillis() - lastCheck > CHECK_EVERY) checkUpdate(false);
    }

    /* ---------------------------------------------------------------- auto-update */
    int currentCode() {
        try {
            android.content.pm.PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? (int) p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) { return 0; }
    }

    String currentName() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }

    boolean canInstall() { return Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls(); }

    void toast(String t) { runOnUiThread(() -> Toast.makeText(this, t, Toast.LENGTH_LONG).show()); }

    void checkUpdate(boolean manual) {
        lastCheck = System.currentTimeMillis();
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(LATEST + "?t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(10000); c.setReadTimeout(15000); c.setUseCaches(false);
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                try (InputStream in = c.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) buf.write(b, 0, n); }
                JSONObject a = new JSONObject(buf.toString("UTF-8")).optJSONObject("android");
                if (a != null && a.optInt("code") > currentCode()) {
                    String ver = a.optString("version"), url = a.optString("url");
                    runOnUiThread(() -> offerUpdate(ver, url));
                } else if (manual) toast("Установлена последняя версия " + currentName());
            } catch (Exception e) { if (manual) toast("Не удалось проверить обновления"); }
        }).start();
    }

    void offerUpdate(String ver, String url) {
        if (isFinishing() || downloading) return;
        new AlertDialog.Builder(this)
            .setTitle("Доступно обновление")
            .setMessage("Moloko CRM " + ver + " (у вас " + currentName() + "). Установить сейчас? Данные и вход сохранятся.")
            .setPositiveButton("Обновить", (d, w) -> download(url))
            .setNegativeButton("Позже", null)
            .show();
    }

    void download(String url) {
        if (!canInstall()) {
            pendingUpdate = url;
            toast("Разрешите установку обновлений для Moloko CRM и вернитесь назад");
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            return;
        }
        downloading = true;
        toast("Скачиваю обновление…");
        new Thread(() -> {
            try {
                File dir = new File(getCacheDir(), "updates");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, "moloko-crm.apk");
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(60000);
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(f)) {
                    byte[] b = new byte[65536]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n);
                }
                Uri uri = FileProvider.getUriForFile(this, "kz.moloko.crm.files", f);
                Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                runOnUiThread(() -> startActivity(install));
            } catch (Exception e) {
                toast("Не удалось скачать обновление. Проверьте интернет.");
            } finally { downloading = false; }
        }).start();
    }

    static boolean isStudio(Uri u) {
        String path = u.getPath() == null ? "" : u.getPath();
        return "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && path.startsWith("/studio");
    }

    void openOutside(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "Нет приложения для этой ссылки", Toast.LENGTH_SHORT).show(); }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == FILE_REQ && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCallback = null;
        }
    }

    void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Уведомления студии", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Новые заявки, оплаты, отмены и запросы");
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
    }

    boolean notifAllowed() {
        return Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    void js(String code) { runOnUiThread(() -> web.evaluateJavascript(code, null)); }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req == NOTIF_REQ) js("window.dispatchEvent(new CustomEvent('moloko-native-permission',{detail:'" + (notifAllowed() ? "granted" : "denied") + "'}))");
    }

    /** Methods the web app calls through window.MolokoNative */
    class Bridge {
        @JavascriptInterface
        public String platform() { return "android"; }

        @JavascriptInterface
        public String version() { return currentName(); }

        @JavascriptInterface
        public void checkUpdate() { MainActivity.this.checkUpdate(true); }

        @JavascriptInterface
        public String notifyPermission() { return notifAllowed() ? "granted" : "default"; }

        @JavascriptInterface
        public void requestNotify() {
            if (Build.VERSION.SDK_INT >= 33 && !notifAllowed()) runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIF_REQ));
            else js("window.dispatchEvent(new CustomEvent('moloko-native-permission',{detail:'granted'}))");
        }

        @JavascriptInterface
        public void notify(String title, String body, String path) {
            if (!notifAllowed()) return;
            Context c = MainActivity.this;
            int id = notifId++;
            Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("path", path == null ? "" : path);
            PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
            b.setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi)
                .setColor(Color.parseColor("#3A6367"));
            getSystemService(NotificationManager.class).notify(id, b.build());
        }

        @JavascriptInterface
        public void saveText(String name, String mime, String text) {
            try {
                File dir = new File(getCacheDir(), "exports");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name.replaceAll("[^\\w.\\-]", "_"));
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(text.getBytes(StandardCharsets.UTF_8)); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, "kz.moloko.crm.files", f);
                Intent send = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(send, name)));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Не удалось сохранить файл", Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public void printHtml(String html, String title) {
            runOnUiThread(() -> {
                printView = new WebView(MainActivity.this);
                printView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView v, String url) {
                        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter ad = v.createPrintDocumentAdapter(title);
                        pm.print(title, ad, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                    }
                });
                printView.loadDataWithBaseURL("https://" + HOST + "/", html, "text/html", "utf-8", null);
            });
        }
    }
}
