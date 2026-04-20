import os
import sys
import zipfile
import shutil
import tempfile
import subprocess
import tkinter as tk
from tkinter import filedialog, messagebox

APP_NAME = "Deal_er Extension Helper Installer"
DEFAULT_EXTRACT_FOLDER_NAME = "Deal_er-v0.1"


def open_url(url: str) -> None:
    try:
        os.startfile(url)
    except Exception as e:
        messagebox.showwarning(
            "Could not open browser page",
            f"Failed to open:\n{url}\n\nError:\n{e}"
        )


def open_folder(path: str) -> None:
    try:
        os.startfile(path)
    except Exception as e:
        messagebox.showwarning(
            "Could not open folder",
            f"Failed to open folder:\n{path}\n\nError:\n{e}"
        )


def pick_zip_file() -> str:
    return filedialog.askopenfilename(
        title="Select the extension ZIP file",
        filetypes=[("ZIP files", "*.zip")]
    )


def pick_extract_location() -> str:
    return filedialog.askdirectory(
        title="Choose where to extract the extension"
    )


def is_valid_extension_folder(path: str) -> bool:
    manifest_path = os.path.join(path, "manifest.json")
    return os.path.isfile(manifest_path)


def find_manifest_root(extract_root: str) -> str | None:
    # First check the root itself
    if is_valid_extension_folder(extract_root):
        return extract_root

    # Then check immediate subfolders
    try:
        for entry in os.listdir(extract_root):
            candidate = os.path.join(extract_root, entry)
            if os.path.isdir(candidate) and is_valid_extension_folder(candidate):
                return candidate
    except OSError:
        return None

    return None


def extract_zip(zip_path: str, destination_root: str) -> str:
    target_folder = os.path.join(destination_root, DEFAULT_EXTRACT_FOLDER_NAME)

    # Clean old install so users do not accidentally load stale files
    if os.path.exists(target_folder):
        shutil.rmtree(target_folder)

    os.makedirs(target_folder, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(target_folder)

    manifest_root = find_manifest_root(target_folder)
    if manifest_root is None:
        raise ValueError(
            "Could not find manifest.json after extraction.\n"
            "Make sure the ZIP contains a valid extension."
        )

    return manifest_root


def choose_browser() -> str | None:
    browser_window = tk.Toplevel()
    browser_window.title("Choose Browser")
    browser_window.geometry("320x180")
    browser_window.resizable(False, False)

    selected = {"value": None}

    label = tk.Label(
        browser_window,
        text="Which browser should be opened for installation?",
        wraplength=280,
        justify="center",
        pady=15
    )
    label.pack()

    def set_browser(browser_name: str) -> None:
        selected["value"] = browser_name
        browser_window.destroy()

    chrome_btn = tk.Button(
        browser_window,
        text="Chrome",
        width=20,
        command=lambda: set_browser("chrome")
    )
    chrome_btn.pack(pady=5)

    opera_btn = tk.Button(
        browser_window,
        text="Opera",
        width=20,
        command=lambda: set_browser("opera")
    )
    opera_btn.pack(pady=5)

    edge_btn = tk.Button(
        browser_window,
        text="Edge",
        width=20,
        command=lambda: set_browser("edge")
    )
    edge_btn.pack(pady=5)

    cancel_btn = tk.Button(
        browser_window,
        text="Cancel",
        width=20,
        command=browser_window.destroy
    )
    cancel_btn.pack(pady=10)

    browser_window.grab_set()
    browser_window.wait_window()

    return selected["value"]


def get_extensions_url(browser: str) -> str:
    if browser == "chrome":
        return "chrome://extensions"
    if browser == "opera":
        return "opera://extensions"
    if browser == "edge":
        return "edge://extensions"
    raise ValueError(f"Unsupported browser: {browser}")


def show_final_instructions(extension_folder: str, browser: str) -> None:
    browser_name = "Chrome" if browser == "chrome" else "Edge"
    instructions = ""

    if browser == "firefox":
        instructions = (
            f"The extension was extracted to:\n\n"
            f"{extension_folder}\n\n"
            f"Next steps in Firefox:\n"
            f"1. Open about:debugging\n"
            f"2. Click 'This Firefox'\n"
            f"3. Click 'Load Temporary Add-on'\n"
            f"4. Select any file inside the extension folder\n\n"
            f"Important:\n"
            f"This Firefox method is temporary and the extension is removed when Firefox restarts."
        )
    else:
        instructions = (
            f"The extension was extracted to:\n\n"
            f"{extension_folder}\n\n"
            f"Next steps in {browser_name}:\n"
            f"1. Turn on Developer mode\n"
            f"2. Click 'Load unpacked'\n"
            f"3. Select the folder shown above\n\n"
            f"The folder has also been opened for you."
        )

    messagebox.showinfo("Install Steps", instructions)


def main() -> None:
    root = tk.Tk()
    root.withdraw()
    root.title(APP_NAME)

    messagebox.showinfo(
        APP_NAME,
        "Select the ZIP file for the extension.\n\n"
        "This helper will NOT directly install the extension.\n\n"
        "It will ONLY extract the extension folder and open your browser's extensions page.\n\n"
    )

    zip_path = pick_zip_file()
    if not zip_path:
        return

    extract_location = pick_extract_location()
    if not extract_location:
        return

    browser = choose_browser()
    if not browser:
        return

    try:
        extension_folder = extract_zip(zip_path, extract_location)
    except zipfile.BadZipFile:
        messagebox.showerror("Invalid ZIP", "The selected file is not a valid ZIP archive.")
        return
    except Exception as e:
        messagebox.showerror("Extraction failed", str(e))
        return

    open_folder(extension_folder)
    open_url(get_extensions_url(browser))
    show_final_instructions(extension_folder, browser)


if __name__ == "__main__":
    main()