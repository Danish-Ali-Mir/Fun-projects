from pathlib import Path
from PIL import Image


IMAGE_EXTENSIONS = {".jpg", ".jpeg"}


def check_image(file_path):
    try:
        with Image.open(file_path) as image:
            image.verify()
        return True
    except Exception:
        return False


def scan_folder(folder, progress_callback=None):
    healthy = []
    corrupted = []
    skipped = 0

    folder = Path(folder)

    image_files = []

    for file_path in folder.rglob("*"):
        if not file_path.is_file():
            continue

        if file_path.suffix.lower() in IMAGE_EXTENSIONS:
            image_files.append(file_path)
        else:
            skipped += 1

    total = len(image_files)

    for current, file_path in enumerate(image_files, start=1):

        if check_image(file_path):
            healthy.append(file_path)
        else:
            corrupted.append(file_path)

        if progress_callback:
            progress_callback(current, total, file_path)

    return healthy, corrupted, skipped