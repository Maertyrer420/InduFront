Set-Location "C:\Users\steve\.gemini\antigravity\scratch\OpenFrontIO-main"
$git = "C:\Users\steve\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd\git.exe"

& $git add -A
& $git commit -m "Scrub all remaining OpenFront emails, press kit, ads.txt, and licenses"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class CredMan {
    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredReadW(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr buffer);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }
    public static string GetSecret(string target) {
        IntPtr credPtr;
        if (CredReadW(target, 1, 0, out credPtr)) {
            var cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
            CredFree(credPtr);
            return System.Text.Encoding.UTF8.GetString(bytes);
        }
        return null;
    }
}
"@

$token = [CredMan]::GetSecret("GitHub - https://api.github.com/Maertyrer420")
if ($token) {
    & $git push "https://x-access-token:${token}@github.com/Maertyrer420/InduFront.git" main
} else {
    Write-Error "No token retrieved"
}
