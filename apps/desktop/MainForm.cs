using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace MolokoCRM
{
    public class MainForm : Form
    {
        public const string Host = "moloko-art-silk.vercel.app";
        const string Start = "https://" + Host + "/studio";
        const string RegKey = @"Software\MolokoCRM";

        readonly WebView2 web;
        readonly NotifyIcon tray;
        readonly bool startHidden;
        bool quitting, trayHintShown;
        string lastPath = "";
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

        public MainForm(bool hidden)
        {
            startHidden = hidden;
            Text = "Moloko CRM";
            Icon = LoadIcon();
            BackColor = Color.FromArgb(18, 16, 14);
            MinimumSize = new Size(820, 560);
            StartPosition = FormStartPosition.Manual;
            RestoreBounds_();

            web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(18, 16, 14) };
            Controls.Add(web);

            var menu = new ContextMenuStrip();
            menu.Items.Add("Открыть Moloko CRM", null, (s, e) => ShowMain());
            menu.Items.Add("Проверить обновления", null, (s, e) => Updater.Check(true));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Выход", null, (s, e) => Quit());
            tray = new NotifyIcon { Icon = Icon, Text = "Moloko CRM", Visible = true, ContextMenuStrip = menu };
            tray.MouseClick += (s, e) => { if (e.Button == MouseButtons.Left) ShowMain(); };
            tray.BalloonTipClicked += (s, e) => { ShowMain(); OpenPath(lastPath); };

            Load += async (s, e) => await Init();
            FormClosing += OnClosing;
        }

        protected override void SetVisibleCore(bool value)
        {
            // started with --tray: stay hidden until the tray icon is clicked
            if (startHidden && !IsHandleCreated) { CreateHandle(); value = false; OnLoad(EventArgs.Empty); }
            base.SetVisibleCore(value);
        }

        static Icon LoadIcon()
        {
            try { using (var s = typeof(MainForm).Assembly.GetManifestResourceStream("app.ico")) return new Icon(s); }
            catch { return SystemIcons.Application; }
        }

        bool initStarted;
        async Task Init()
        {
            if (initStarted) return;
            initStarted = true;
            try
            {
                var data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MolokoCRM", "WebView2");
                var env = await CoreWebView2Environment.CreateAsync(null, data);
                await web.EnsureCoreWebView2Async(env);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                if (MessageBox.Show("Для работы нужен компонент Microsoft Edge WebView2. Открыть страницу загрузки?", "Moloko CRM", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                    OpenOutside("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                Quit();
                return;
            }
            catch (Exception ex)
            {
                MessageBox.Show("Не удалось запустить: " + ex.Message, "Moloko CRM", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Quit();
                return;
            }

            var cw = web.CoreWebView2;
            cw.Settings.UserAgent = cw.Settings.UserAgent + " MolokoCRM/Windows";
            cw.Settings.IsStatusBarEnabled = false;
            cw.Settings.AreDevToolsEnabled = false;
            cw.Settings.IsZoomControlEnabled = true;
            await cw.AddScriptToExecuteOnDocumentCreatedAsync(BridgeJs());
            cw.WebMessageReceived += OnMessage;
            cw.NavigationStarting += (s, e) => { if (!IsStudio(e.Uri)) { e.Cancel = true; OpenOutside(e.Uri); } };
            cw.NewWindowRequested += (s, e) => { e.Handled = true; if (IsStudio(e.Uri)) cw.Navigate(e.Uri); else OpenOutside(e.Uri); };
            cw.PermissionRequested += (s, e) => { if (e.PermissionKind == CoreWebView2PermissionKind.Notifications) e.State = CoreWebView2PermissionState.Allow; };
            cw.DocumentTitleChanged += (s, e) => { var t = cw.DocumentTitle; Text = string.IsNullOrEmpty(t) ? "Moloko CRM" : t; };
            cw.ProcessFailed += (s, e) => { if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited || e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited) try { cw.Reload(); } catch { } };
            cw.Navigate(Start);
            Updater.Start(this);
        }

        static string BridgeJs()
        {
            var ver = Json.Serialize(Updater.CurrentName);
            return @"(function(){
  if (window.MolokoNative || !window.chrome || !window.chrome.webview) return;
  var post = function(o){ window.chrome.webview.postMessage(JSON.stringify(o)); };
  window.MolokoNative = {
    platform: function(){ return 'windows'; },
    version: function(){ return " + ver + @"; },
    notifyPermission: function(){ return 'granted'; },
    requestNotify: function(){ setTimeout(function(){ window.dispatchEvent(new CustomEvent('moloko-native-permission', { detail: 'granted' })); }, 0); },
    notify: function(t, b, p){ post({ t: 'notify', title: String(t || ''), body: String(b || ''), path: String(p || '') }); },
    checkUpdate: function(){ post({ t: 'update' }); }
  };
  window.chrome.webview.addEventListener('message', function(e){ var d = e.data; if (d && d.open && window.__molokoOpen) window.__molokoOpen(d.open); });
})();";
        }

        void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            Dictionary<string, object> m;
            try { m = Json.Deserialize<Dictionary<string, object>>(e.TryGetWebMessageAsString()); } catch { return; }
            if (m == null || !m.TryGetValue("t", out var t)) return;
            switch (t as string)
            {
                case "notify":
                    lastPath = m.TryGetValue("path", out var p) ? p as string ?? "" : "";
                    var title = m.TryGetValue("title", out var ti) ? ti as string : "Moloko CRM";
                    var body = m.TryGetValue("body", out var bo) ? bo as string : "";
                    tray.ShowBalloonTip(6000, string.IsNullOrEmpty(title) ? "Moloko CRM" : title, string.IsNullOrEmpty(body) ? " " : body, ToolTipIcon.None);
                    if (!Visible || WindowState == FormWindowState.Minimized) FlashTaskbar();
                    break;
                case "update":
                    Updater.Check(true);
                    break;
            }
        }

        public void OpenPath(string path)
        {
            if (string.IsNullOrEmpty(path) || web.CoreWebView2 == null) return;
            web.CoreWebView2.PostWebMessageAsJson(Json.Serialize(new Dictionary<string, string> { { "open", path } }));
        }

        static bool IsStudio(string uri)
        {
            if (!Uri.TryCreate(uri, UriKind.Absolute, out var u)) return false;
            if (u.Scheme == "about" || u.Scheme == "data" || u.Scheme == "blob") return true;
            return u.Scheme == Uri.UriSchemeHttps && u.Host == Host && u.AbsolutePath.StartsWith("/studio");
        }

        static void OpenOutside(string uri)
        {
            try
            {
                if (!Uri.TryCreate(uri, UriKind.Absolute, out var u)) return;
                if (u.Scheme != "https" && u.Scheme != "http" && u.Scheme != "mailto" && u.Scheme != "tel" && u.Scheme != "whatsapp") return;
                Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true });
            }
            catch { }
        }

        public void ShowMain()
        {
            if (!Visible) Show();
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            Activate();
            BringToFront();
        }

        public bool IsInUse => Visible && WindowState != FormWindowState.Minimized && ContainsFocus;

        void OnClosing(object sender, FormClosingEventArgs e)
        {
            SaveBounds();
            if (!quitting && e.CloseReason == CloseReason.UserClosing)
            {
                // keep running in the tray so notifications keep coming
                e.Cancel = true;
                Hide();
                if (!trayHintShown)
                {
                    trayHintShown = true;
                    tray.ShowBalloonTip(4000, "Moloko CRM работает в фоне", "Уведомления продолжат приходить. Выйти можно через значок в трее.", ToolTipIcon.None);
                }
                return;
            }
            tray.Visible = false;
        }

        public void Quit()
        {
            quitting = true;
            tray.Visible = false;
            Close();
            Application.Exit();
        }

        void RestoreBounds_()
        {
            var screen = Screen.PrimaryScreen.WorkingArea;
            var def = new Rectangle(screen.X + screen.Width / 10, screen.Y + screen.Height / 12, screen.Width * 8 / 10, screen.Height * 10 / 12);
            try
            {
                using (var k = Registry.CurrentUser.OpenSubKey(RegKey))
                {
                    var s = k?.GetValue("Bounds") as string;
                    if (s != null)
                    {
                        var a = Array.ConvertAll(s.Split(','), int.Parse);
                        var r = new Rectangle(a[0], a[1], a[2], a[3]);
                        foreach (var sc in Screen.AllScreens) if (sc.WorkingArea.IntersectsWith(r)) { def = r; break; }
                        if (a.Length > 4 && a[4] == 1) WindowState = FormWindowState.Maximized;
                    }
                }
            }
            catch { }
            Bounds = def;
        }

        void SaveBounds()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                using (var k = Registry.CurrentUser.CreateSubKey(RegKey))
                    k.SetValue("Bounds", $"{r.X},{r.Y},{r.Width},{r.Height},{(WindowState == FormWindowState.Maximized ? 1 : 0)}");
            }
            catch { }
        }

        public void TrayInfo(string title, string text) => tray.ShowBalloonTip(4000, title, text, ToolTipIcon.None);

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        static extern bool FlashWindow(IntPtr hwnd, bool invert);
        void FlashTaskbar() { try { FlashWindow(Handle, true); } catch { } }
    }
}
