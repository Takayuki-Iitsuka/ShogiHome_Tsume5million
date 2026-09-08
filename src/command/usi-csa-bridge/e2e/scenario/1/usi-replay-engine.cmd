@echo off
rem Windows向けモックUSIエンジン起動ラッパー。
rem background/usi/process.ts の ChildProcess は .cmd を cmd.exe /c 経由で
rem 起動するため、シバン行(#!/bin/bash)に依存しないこの形が必要。
npx --no-install tsx "%~dp0..\..\mock\usi-replay-engine.ts" "%~dp0usi.log"
