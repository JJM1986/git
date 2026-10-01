@echo off
rem Fuellt die BEI_BW-Vorlage C aus einer JSON-Zuordnung.
rem Aufruf: fuellen.cmd Vorlage.docx zuordnung.json Ausgabe.docx
rem Voraussetzung: Python 3 und einmalig: pip install python-docx
python "%~dp0fill_bei_bw_c.py" %1 %2 %3
pause
