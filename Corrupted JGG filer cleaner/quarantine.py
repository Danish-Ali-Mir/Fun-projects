from pathlib import Path
import shutil


def move_to_quarantine(files, original_folder):

    original_folder = Path(original_folder)
    quarantine_folder = original_folder / "Quarantine"

    quarantine_folder.mkdir(exist_ok=True)

    moved_files = []
    failed_files = []

    for file_path in files:

        file_path = Path(file_path)

        try:
            relative_path = file_path.relative_to(original_folder)

            destination = quarantine_folder / relative_path

            destination.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            shutil.move(
                str(file_path),
                str(destination)
            )

            moved_files.append(destination)

        except Exception:
            failed_files.append(file_path)

    return moved_files, failed_files