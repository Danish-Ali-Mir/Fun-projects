# JPG Corruption Cleaner

A simple Windows desktop application built with Python that scans folders for corrupted JPG/JPEG images and safely moves them to a separate **Quarantine** folder.

The application uses traditional file and image validation techniques rather than Machine Learning.

## Features

- Select any folder using a graphical interface
- Scan folders and subfolders recursively
- Detect corrupted `.jpg` and `.jpeg` files
- Ignore videos and other file types
- Display scanning progress
- Show healthy and corrupted image counts
- Display the paths of corrupted images
- Move corrupted images to a `Quarantine` folder
- Preserve the original folder structure inside Quarantine
- Ask for confirmation before moving files
- Files are moved, not permanently deleted

## Tech Stack

- **Python**
- **PySide6** – Desktop GUI
- **Pillow** – JPEG image validation
- **pathlib** – File and folder handling
- **shutil** – Moving files
- **PyInstaller** – Planned for creating a standalone `.exe`

## Project Structure

```text
corrupt-jpg-file-cleaner/
│
├── app.py
├── scanner.py
├── quarantine.py
├── test_scanner.py
├── requirements.txt
├── README.md
└── venv/
