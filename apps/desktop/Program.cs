using System;
using System.Linq;
using System.Threading;
using System.Windows.Forms;

namespace MolokoCRM
{
    static class Program
    {
        const string MutexName = "MolokoCRM.Single";
        const string ShowEvent = "MolokoCRM.Show";

        [STAThread]
        static void Main(string[] args)
        {
            using (var mutex = new Mutex(true, MutexName, out bool first))
            {
                if (!first)
                {
                    // already running: bring the existing window forward
                    try { EventWaitHandle.OpenExisting(ShowEvent).Set(); } catch { }
                    return;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                bool tray = args.Any(a => a == "--tray") || Updater.ConsumeStartHidden();
                var form = new MainForm(tray);
                var show = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEvent);
                var t = new Thread(() => { while (true) { show.WaitOne(); try { form.BeginInvoke((Action)form.ShowMain); } catch { return; } } }) { IsBackground = true };
                t.Start();
                Application.Run(form);
            }
        }
    }
}
