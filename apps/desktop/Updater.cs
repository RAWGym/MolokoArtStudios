using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace MolokoCRM
{
    /// <summary>Checks latest.json in the public app bucket and installs newer builds silently (per-user installer, no admin prompt).</summary>
    static class Updater
    {
        const string Latest = "https://erztkmhaehqpgqgfwjsh.supabase.co/storage/v1/object/public/moloko-apps/latest.json";
        static readonly string Flag = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MolokoCRM", "start-hidden");
        static MainForm form;
        static Timer timer;
        static bool busy;

        static Version V => Assembly.GetExecutingAssembly().GetName().Version;
        public static int CurrentCode => V.Build;
        public static string CurrentName => $"{V.Major}.{V.Minor}.{V.Build}";

        public static bool ConsumeStartHidden()
        {
            try { if (File.Exists(Flag)) { File.Delete(Flag); return true; } } catch { }
            return false;
        }

        public static void Start(MainForm f)
        {
            form = f;
            var first = new Timer { Interval = 8000 };
            first.Tick += (s, e) => { first.Stop(); first.Dispose(); Check(false, true); };
            first.Start();
            timer = new Timer { Interval = 3 * 60 * 60 * 1000 };
            timer.Tick += (s, e) => Check(false);
            timer.Start();
        }

        public static async void Check(bool manual, bool atStart = false)
        {
            if (busy) return;
            busy = true;
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                string json;
                using (var wc = new WebClient { Encoding = System.Text.Encoding.UTF8 })
                    json = await wc.DownloadStringTaskAsync(Latest + "?t=" + DateTime.UtcNow.Ticks);
                var d = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
                var w = d != null && d.TryGetValue("windows", out var o) ? o as Dictionary<string, object> : null;
                var code = w != null && w.TryGetValue("code", out var c) ? Convert.ToInt32(c) : 0;
                if (w == null || code <= CurrentCode)
                {
                    if (manual) MessageBox.Show(form, $"Установлена последняя версия {CurrentName}.", "Moloko CRM", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                var ver = w.TryGetValue("version", out var v) ? v as string : code.ToString();
                var url = w["url"] as string;
                // just opened, hidden in the tray or asked by hand: update right away; otherwise ask first
                bool ask = !manual && !atStart && form.IsInUse;
                if (ask && MessageBox.Show(form, $"Доступна новая версия Moloko CRM {ver} (у вас {CurrentName}).\nОбновить сейчас? Приложение перезапустится за пару секунд.", "Обновление", MessageBoxButtons.YesNo, MessageBoxIcon.Information) != DialogResult.Yes) return;
                await Install(url, ver);
            }
            catch (Exception ex)
            {
                if (manual) MessageBox.Show(form, "Не удалось проверить обновления: " + ex.Message, "Moloko CRM", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            finally { busy = false; }
        }

        static async Task Install(string url, string ver)
        {
            form.TrayInfo("Обновление Moloko CRM", $"Скачиваю версию {ver}…");
            var tmp = Path.Combine(Path.GetTempPath(), "MolokoCRM-Setup-" + ver + ".exe");
            using (var wc = new WebClient()) await wc.DownloadFileTaskAsync(url, tmp);
            if (!form.Visible)
            {
                try { Directory.CreateDirectory(Path.GetDirectoryName(Flag)); File.WriteAllText(Flag, "1"); } catch { }
            }
            Process.Start(new ProcessStartInfo(tmp, "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS") { UseShellExecute = true });
            form.Quit();
        }
    }
}
