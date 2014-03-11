'Proper command line usage of this script is:
'	getlivery [-beta] [filename]
'
'where the -beta argument will parse the DCS World Openbeta main folder and user folder
'and filename is the name of the output file.
'If no path is specified, the file will be output to the DCS user folder (main or openbeta depending on -beta argument).
'If no filename is specified, the output will be "DCS_Liveries.txt" in the DCS user folder.
'If you want the filename created in the same folder as this script, use the following line:
'	getlivery [-beta] .\filename
'
'IMPORTANT: if you use the -beta argument, it must come before the filename.


dim dcsfolder ,userfolder, userdcsfolder, livery_dcs, livery_user, outfile, outfile_default, output_text , i
dim ObjectList(), LiveryList() 
dim fs
dim fsout
Dim WSHShell,WshSysEnv

Set WSHShell = CreateObject("WScript.Shell")
Set WshSysEnv = WshShell.Environment("PROCESS")
set fs = CreateObject("Scripting.FileSystemObject")
outfile_default = "DCS_Liveries.txt"	'can be changed if you wish to change default output filename

userfolder = WshSysEnv("USERPROFILE") 'no trailing backslash
if wscript.arguments.count > 0 then		'either beta or specific filename
	if InStr(1,wscript.arguments.item(0),"-beta",1) <> 0 then	'argument(0) is -beta
		dcsfolder = readFromRegistry("HKEY_CURRENT_USER\Software\Eagle Dynamics\DCS World OpenBeta\Path","c:\program files (x86)\Eagle Dynamics\DCS World OpenBeta")	'no trailing backslash
		userdcsfolder = "\Saved Games\DCS.openbeta"
		if wscript.arguments.count > 1 then		'at least 2 arguments, second is specific filename (additional arguments ignored)
			PathCheck wscript.arguments.item(1)	'PathCheck looks for relative or absolute paths in the argument to determine file location
		else	'1 argument only (-beta); default filename
			PathCheck outfile_default
		end if
	else	'argument(0) is filename, not -beta
		dcsfolder = readFromRegistry("HKEY_CURRENT_USER\Software\Eagle Dynamics\DCS World\Path","c:\program files (x86)\Eagle Dynamics\DCS World")	'no trailing backslash
		userdcsfolder = "\Saved Games\DCS"
		PathCheck wscript.arguments.item(0)
	end if
else		'no arguments, so default filename and folder location
	dcsfolder = readFromRegistry("HKEY_CURRENT_USER\Software\Eagle Dynamics\DCS World\Path","c:\program files (x86)\Eagle Dynamics\DCS World")	'no trailing backslash
	userdcsfolder = "\Saved Games\DCS"
	PathCheck outfile_default
end if


'livery folders are dcsfolder & livery_dcs and userfolder & livery_user
livery_dcs = "\bazar\liveries"
livery_user = userdcsfolder & "\Liveries"

'msgbox dcsfolder & vbcrlf & userfolder & userdcsfolder & vbcrlf & dcsfolder & livery_dcs & vbcrlf & userfolder & livery_user 	'for debugging

GetObjectsList(dcsfolder & livery_dcs)	'gets names of aircraft and objects in default liveries folder
redim LiveryList(ubound(ObjectList))	'redim livery list to number of objects so that they match up

for i = 0 to ubound(ObjectList)			'assign all liveries to objects
	if ObjectList(i) <> "" then 	'must not be null
		LiveryList(i) = chr(34) & ObjectList(i) & chr(34) & ": [" 	'e.g. "A-10C": [
		LiveryList(i) = LiveryList(i) & GetLiveries(dcsfolder & livery_dcs & "\" & ObjectList(i)) 	'liveries in default DCS folder
		if fs.FolderExists(userfolder & livery_user & "\" & ObjectList(i)) then LiveryList(i) = LiveryList(i) & GetLiveries(userfolder & livery_user & "\" & ObjectList(i) )	'liveries in DCS user folder (if folder exists)
		if InStr(1,LiveryList(i),", ",0) > 0 then LiveryList(i) = LEFT(LiveryList(i), LEN(LiveryList(i))-2) 'removes trailing comma and space of last entry if at least one entry exists
		LiveryList(i) = LiveryList(i) & "]"		'closes out line
		'msgbox LiveryList(i)	'display entire line for debugging
	end if
Next

'format output for writing
output_text = "{" & vbcrlf		'Open bracket to start the entire text stream
for i = 0 to ubound(LiveryList)	'covers every object and livery
	if LiveryList(i) <> "" then output_text = output_text & vbtab & LiveryList(i) & ", " & vbcrlf	'verify no null entries
Next
output_text = LEFT(output_text, LEN(output_text)-4)	& vbcrlf &  "}"	'subtract  CR/LF & comma; CR/LF and close bracket closes out text stream

'output to text file
msgbox "Your DCS Livery List will be saved to the following file:" & vbcrlf & outfile		'useful for people to know where to find the file
set fsout = fs.CreateTextFile(outfile, true,true) 
fsout.Write (output_text)
fsout.Close


'close out
set fs = nothing
set WSHShell = nothing



'Subs and Functions:
	
Sub GetObjectsList(folderspec)
    Dim  f, f1, fc, s, i
    Set f = fs.GetFolder(folderspec)
    Set fc = f.SubFolders
	i = 0
    For Each f1 in fc
		redim preserve Objectlist(i+1)
        ObjectList(i) = f1.name 
		i = i+1
    Next
End Sub

function GetLiveries(folderspec)
    Dim f, f1, fc, s
    Set f = fs.GetFolder(folderspec)
    Set fc = f.SubFolders
    For Each f1 in fc
        s =  s & chr(34) & f1.name & chr(34) & ", "
    Next
	GetLiveries = s
End function

function readFromRegistry (strRegistryKey, strDefault )
    Dim value
    On Error Resume Next
    value = WSHShell.RegRead( strRegistryKey )
    if err.number <> 0 then
        readFromRegistry= strDefault
    else
        readFromRegistry=value
    end if
end function

Sub PathCheck(filespec)	'looks to see if path is already incorporated into argument, otherwise will dump into DCS User folder
	dim checkval(1)		'update based on number of strings to check
	dim j
	
	'strings to check (must match array dimension in dim statement)
	checkval(0) = "\"
	checkval(1) = ".."
	
	for j = 0 to ubound(checkval)
		if InStr(1,filespec,checkval(j),0) > 0 then		'string was found; filename argument includes path
			outfile = filespec
			exit sub
		end if
	next 
	outfile = userfolder & userdcsfolder & "\" & filespec	'no path was included in argument; path will be DCS user folder
end sub
