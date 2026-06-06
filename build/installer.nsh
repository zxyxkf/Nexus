; Kill running Nexus.exe before uninstall to prevent leftover processes
!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM Nexus.exe'
  Sleep 1500
!macroend
