Option Explicit

Dim shell, files, root, daemon, node
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
daemon = files.BuildPath(root, "Trinity-PC-Bridge-Daemon.mjs")
If Not files.FileExists(daemon) Then WScript.Quit 2

node = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If WScript.Arguments.Named.Exists("node") Then node = WScript.Arguments.Named("node")
If Not files.FileExists(node) Then WScript.Quit 3

If WScript.Arguments.Named.Exists("check") Then WScript.Quit 0
shell.CurrentDirectory = root
shell.Run Chr(34) & node & Chr(34) & " " & Chr(34) & daemon & Chr(34), 0, False
