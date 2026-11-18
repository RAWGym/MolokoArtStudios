; Moloko CRM for Windows: per-user install, so updates run silently without an admin prompt.
#define AppVer GetEnv("APP_VERSION")
#if AppVer == ""
  #define AppVer "1.0.0"
#endif

[Setup]
AppId={{8C1B2E7A-4D5F-4B8E-9C3A-6D2F1E0A7B93}
AppName=Moloko CRM
AppVersion={#AppVer}
AppVerName=Moloko CRM {#AppVer}
AppPublisher=Moloko Art Studios
DefaultDirName={localappdata}\Programs\Moloko CRM
DefaultGroupName=Moloko CRM
DisableProgramGroupPage=yes
DisableDirPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
OutputDir=out
OutputBaseFilename=MolokoCRM-Setup
SetupIconFile=app.ico
UninstallDisplayIcon={app}\MolokoCRM.exe
UninstallDisplayName=Moloko CRM
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no
ShowLanguageDialog=no

[Languages]
Name: "ru"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "Ярлык на рабочем столе"
Name: "autostart"; Description: "Запускать при входе в Windows (в трее, чтобы приходили уведомления)"

[Files]
Source: "bin\Release\net48\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion; Excludes: "*.pdb,*.xml"

[Icons]
Name: "{autoprograms}\Moloko CRM"; Filename: "{app}\MolokoCRM.exe"
Name: "{autodesktop}\Moloko CRM"; Filename: "{app}\MolokoCRM.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MolokoCRM"; ValueData: """{app}\MolokoCRM.exe"" --tray"; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{app}\MolokoCRM.exe"; Description: "Открыть Moloko CRM"; Flags: nowait postinstall
