import sys

from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QVBoxLayout,
    QPushButton,
    QLabel,
    QProgressBar,
    QListWidget,
    QFileDialog,
    QMessageBox
)

from PySide6.QtCore import QThread, Signal

from scanner import scan_folder
from quarantine import move_to_quarantine


class ScannerWorker(QThread):

    progress = Signal(int, int, str)
    finished_scan = Signal(list, list, int)

    def __init__(self, folder):
        super().__init__()
        self.folder = folder

    def update_progress(self, current, total, file_path):
        self.progress.emit(
            current,
            total,
            str(file_path)
        )

    def run(self):

        healthy, corrupted, skipped = scan_folder(
            self.folder,
            self.update_progress
        )

        self.finished_scan.emit(
            healthy,
            corrupted,
            skipped
        )


class JPGCleaner(QWidget):

    def __init__(self):
        super().__init__()

        self.folder = None
        self.worker = None
        self.corrupted_files = []

        self.setWindowTitle("JPG Corruption Cleaner")
        self.resize(750, 650)

        self.create_ui()

    def create_ui(self):

        layout = QVBoxLayout()

        title = QLabel(
            "JPG CORRUPTION CLEANER"
        )

        title.setStyleSheet(
            "font-size: 24px; "
            "font-weight: bold;"
        )

        self.folder_label = QLabel(
            "No folder selected"
        )

        browse_button = QPushButton(
            "Browse Folder"
        )

        browse_button.clicked.connect(
            self.select_folder
        )

        self.scan_button = QPushButton(
            "Scan Images"
        )

        self.scan_button.clicked.connect(
            self.start_scan
        )

        self.quarantine_button = QPushButton(
            "Move Corrupted to Quarantine"
        )

        self.quarantine_button.clicked.connect(
            self.quarantine_files
        )

        self.quarantine_button.setEnabled(
            False
        )

        self.progress_bar = QProgressBar()

        self.progress_bar.setValue(0)

        self.status_label = QLabel(
            "Ready"
        )

        self.results_label = QLabel(
            "Scanned: 0    "
            "Healthy: 0    "
            "Corrupted: 0"
        )

        corrupted_title = QLabel(
            "Corrupted JPG Files:"
        )

        self.corrupted_list = QListWidget()

        layout.addWidget(title)
        layout.addWidget(self.folder_label)

        layout.addWidget(
            browse_button
        )

        layout.addWidget(
            self.scan_button
        )

        layout.addWidget(
            self.quarantine_button
        )

        layout.addWidget(
            self.progress_bar
        )

        layout.addWidget(
            self.status_label
        )

        layout.addWidget(
            self.results_label
        )

        layout.addWidget(
            corrupted_title
        )

        layout.addWidget(
            self.corrupted_list
        )

        self.setLayout(layout)

    def select_folder(self):

        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder"
        )

        if folder:

            self.folder = folder

            self.folder_label.setText(
                folder
            )

            self.progress_bar.setValue(0)

            self.status_label.setText(
                "Folder selected. Ready to scan."
            )

            self.corrupted_list.clear()

            self.corrupted_files = []

            self.quarantine_button.setEnabled(
                False
            )

    def start_scan(self):

        if not self.folder:

            QMessageBox.warning(
                self,
                "No Folder",
                "Please select a folder first."
            )

            return

        self.corrupted_list.clear()

        self.corrupted_files = []

        self.progress_bar.setValue(0)

        self.status_label.setText(
            "Scanning..."
        )

        self.results_label.setText(
            "Scanned: 0    "
            "Healthy: 0    "
            "Corrupted: 0"
        )

        self.scan_button.setEnabled(
            False
        )

        self.quarantine_button.setEnabled(
            False
        )

        self.worker = ScannerWorker(
            self.folder
        )

        self.worker.progress.connect(
            self.update_progress
        )

        self.worker.finished_scan.connect(
            self.scan_finished
        )

        self.worker.start()

    def update_progress(
        self,
        current,
        total,
        file_path
    ):

        if total > 0:

            percentage = int(
                current / total * 100
            )

            self.progress_bar.setValue(
                percentage
            )

        self.status_label.setText(
            f"Checking: {file_path}"
        )

        self.results_label.setText(
            f"Checked: {current} / {total}"
        )

    def scan_finished(
        self,
        healthy,
        corrupted,
        skipped
    ):

        self.corrupted_files = corrupted

        total_scanned = (
            len(healthy) +
            len(corrupted)
        )

        self.results_label.setText(
            f"Scanned: {total_scanned}    "
            f"Healthy: {len(healthy)}    "
            f"Corrupted: {len(corrupted)}"
        )

        for file_path in corrupted:

            self.corrupted_list.addItem(
                str(file_path)
            )

        self.progress_bar.setValue(100)

        self.status_label.setText(
            f"Scan complete. "
            f"{len(corrupted)} corrupted files found."
        )

        self.scan_button.setEnabled(
            True
        )

        self.quarantine_button.setEnabled(
            len(corrupted) > 0
        )

    def quarantine_files(self):

        if not self.corrupted_files:

            QMessageBox.information(
                self,
                "No Files",
                "There are no corrupted files to move."
            )

            return

        answer = QMessageBox.question(
            self,
            "Confirm Quarantine",
            f"{len(self.corrupted_files)} "
            "corrupted files were found.\n\n"
            "Move them to the Quarantine folder?",
            QMessageBox.Yes |
            QMessageBox.No
        )

        if answer != QMessageBox.Yes:

            return

        moved, failed = move_to_quarantine(
            self.corrupted_files,
            self.folder
        )

        self.corrupted_files = []

        self.corrupted_list.clear()

        self.quarantine_button.setEnabled(
            False
        )

        self.status_label.setText(
            f"Moved {len(moved)} files "
            "to Quarantine."
        )

        if failed:

            QMessageBox.warning(
                self,
                "Some Files Failed",
                f"{len(moved)} files were moved.\n"
                f"{len(failed)} files could not be moved."
            )

        else:

            QMessageBox.information(
                self,
                "Complete",
                f"{len(moved)} corrupted files "
                "were moved to the Quarantine folder."
            )


app = QApplication(sys.argv)

window = JPGCleaner()

window.show()

sys.exit(
    app.exec()
)