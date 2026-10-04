from scanner import scan_folder


folder = input("Enter folder path: ")

healthy, corrupted, skipped = scan_folder(folder)

print("\n========== RESULTS ==========")

print("Healthy:", len(healthy))
print("Corrupted:", len(corrupted))
print("Skipped:", skipped)

print("\nCorrupted files:")

for file in corrupted:
    print(file)