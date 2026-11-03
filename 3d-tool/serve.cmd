@echo off
cd /d %~dp0
"C:\Users\18190\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" -m http.server 8765
