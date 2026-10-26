// Pencereyi masaüstü simgelerinin ARKASINDAKİ katmana (duvar kağıdı katmanı) gömer / geri çıkarır.
// Windows'a özgü; PowerShell + user32 çağrıları kullanır (ek bağımlılık yok).
const { execFile } = require('child_process');

const PS = `
param([long]$h, [string]$mode)
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public class WP {
  public delegate bool EP(IntPtr a, IntPtr b);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EP p, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string t);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string t);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int MapWindowPoints(IntPtr f, IntPtr t, ref RECT r, int n);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")] public static extern IntPtr GetL(IntPtr h, int i);
  [DllImport("user32.dll", EntryPoint="SetWindowLongPtr")] public static extern IntPtr SetL(IntPtr h, int i, IntPtr v);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool RedrawWindow(IntPtr h, IntPtr r, IntPtr g, uint f);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool SystemParametersInfo(uint a, uint b, string c, uint d);
  public static void Repaint() {
    // Duvar kağıdını yeniden yükle ve masaüstü katmanlarını baştan çiz (gömülü pencerenin bıraktığı siyah alan kalmasın)
    SystemParametersInfo(0x0014, 0, null, 0x0002);
    IntPtr prog = FindWindow("Progman", null);
    RedrawWindow(prog, IntPtr.Zero, IntPtr.Zero, 0x0001 | 0x0004 | 0x0080 | 0x0100);
    IntPtr w = IntPtr.Zero;
    while ((w = FindWindowEx(IntPtr.Zero, w, "WorkerW", null)) != IntPtr.Zero) RedrawWindow(w, IntPtr.Zero, IntPtr.Zero, 0x0001 | 0x0004 | 0x0080 | 0x0100);
    RedrawWindow(IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 0x0001 | 0x0004 | 0x0080 | 0x0100);
  }
  public static IntPtr Prog() { return FindWindow("Progman", null); }
  public static IntPtr Found = IntPtr.Zero;
  public static IntPtr FindWorker() {
    IntPtr prog = FindWindow("Progman", null); IntPtr r;
    SendMessageTimeout(prog, 0x052C, IntPtr.Zero, IntPtr.Zero, 0, 1000, out r);
    Found = IntPtr.Zero;
    EnumWindows((a, b) => {
      if (FindWindowEx(a, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero)
        Found = FindWindowEx(IntPtr.Zero, a, "WorkerW", null);
      return true; }, IntPtr.Zero);
    if (Found == IntPtr.Zero) Found = FindWindowEx(prog, IntPtr.Zero, "WorkerW", null); // yeni Windows 11 düzeni
    return Found;
  }
}
"@
$w = [IntPtr]$h
$GWL_STYLE = -16
if ($mode -eq 'lower') {
  [WP]::SetWindowPos($w, [IntPtr]1, 0, 0, 0, 0, 0x0013) | Out-Null   # HWND_BOTTOM: normal pencerelerin en altı (masaüstünün üstünde, tarayıcı vb. pencerelerin altında)
  Write-Output 'OK'
} elseif ($mode -eq 'embed') {
  $rc = New-Object WP+RECT; [WP]::GetWindowRect($w, [ref]$rc) | Out-Null
  $p = [WP]::FindWorker()
  if ($p -eq [IntPtr]::Zero) { Write-Output 'NOWORKER'; exit 2 }
  $st = [WP]::GetL($w, $GWL_STYLE).ToInt64()
  $st = ($st -band (-bnot 0x80000000L)) -bor 0x40000000L   # WS_POPUP kaldır, WS_CHILD ekle
  [WP]::SetL($w, $GWL_STYLE, [IntPtr]$st) | Out-Null
  [WP]::SetParent($w, $p) | Out-Null
  [WP]::MapWindowPoints([IntPtr]::Zero, $p, [ref]$rc, 2) | Out-Null
  [WP]::SetWindowPos($w, [IntPtr]::Zero, $rc.L, $rc.T, $rc.R - $rc.L, $rc.B - $rc.T, 0x0054) | Out-Null  # NOZORDER|NOACTIVATE|SHOWWINDOW
  $par = [WP]::GetParent($w); $cs = New-Object System.Text.StringBuilder 64; [WP]::GetClassName($par, $cs, 64) | Out-Null
  $r2 = New-Object WP+RECT; [WP]::GetWindowRect($w, [ref]$r2) | Out-Null
  Write-Output ('OK parent=' + $par + ' ' + $cs + ' vis=' + [WP]::IsWindowVisible($w) + ' rect=' + $r2.L + ',' + $r2.T + ',' + $r2.R + ',' + $r2.B)
} else {
  $rc = New-Object WP+RECT; [WP]::GetWindowRect($w, [ref]$rc) | Out-Null
  [WP]::SetParent($w, [IntPtr]::Zero) | Out-Null
  $st = [WP]::GetL($w, $GWL_STYLE).ToInt64()
  $st = ($st -band (-bnot 0x40000000L)) -bor 0x80000000L
  [WP]::SetL($w, $GWL_STYLE, [IntPtr]$st) | Out-Null
  [WP]::SetWindowPos($w, [IntPtr]::Zero, $rc.L, $rc.T, $rc.R - $rc.L, $rc.B - $rc.T, 0x0054) | Out-Null
  [WP]::Repaint()
  Write-Output 'OK'
}
`;

function run(win, mode) {
    return new Promise((resolve) => {
        if (process.platform !== 'win32' || !win || win.isDestroyed()) return resolve(false);
        const buf = win.getNativeWindowHandle();
        const hwnd = buf.length >= 8 ? buf.readBigUInt64LE(0).toString() : String(buf.readUInt32LE(0));
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
            `& { ${PS} } -h ${hwnd} -mode ${mode}`], { timeout: 15000, windowsHide: true }, (err, out, stderr) => {
            try { require("fs").appendFileSync(require("path").join(require("os").tmpdir(), "cod_wp.log"), mode + ": " + (out || "") + (stderr || "") + (err ? String(err) : "") + "\n"); } catch (e) {}
            resolve(!err && /OK/.test(out || ''));
        });
    });
}

module.exports = {
    embed: (win) => run(win, 'embed'),
    detach: (win) => run(win, 'detach'),
    lower: (win) => run(win, 'lower'),
};
