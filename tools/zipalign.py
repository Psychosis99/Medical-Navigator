#!/usr/bin/env python3
"""Assemble an aligned APK: aapt2 output + classes.dex (+ extra files).

Replaces the Android SDK's `zipalign`: STORED entries are padded so their data
starts on a 4-byte boundary (4096 for .so), and resources.arsc is always stored
uncompressed as required for apps targeting API 30+.
"""
import shutil
import struct
import sys
import zipfile


def data_offset(zf):
    """Byte offset where the next local file header will be written."""
    zf.fp.flush()
    return zf.fp.tell()


def add(out, name, data, stored):
    info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    if stored:
        alignment = 4096 if name.endswith(".so") else 4
        # local header = 30 bytes + filename + extra
        header = data_offset(out) + 30 + len(name.encode("utf-8"))
        pad = (alignment - (header % alignment)) % alignment
        if pad:
            if pad < 4:  # extra field needs a 4-byte id/size header
                pad += alignment
            info.extra = struct.pack("<HH", 0xD935, pad - 4) + b"\0" * (pad - 4)
    out.writestr(info, data)


def main():
    base, dex, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    extra = []  # list of (name_in_apk, path_on_disk)
    for spec in sys.argv[4:]:
        name, _, path = spec.partition("=")
        extra.append((name, path))

    stored_ext = (".arsc", ".so", ".png", ".jpg", ".jpeg", ".gif", ".webp",
                  ".ogg", ".mp3", ".mp4", ".ttf", ".otf", ".woff", ".woff2")
    with zipfile.ZipFile(base) as src, zipfile.ZipFile(out_path, "w") as out:
        for info in src.infolist():
            if info.is_dir():
                continue
            data = src.read(info.filename)
            add(out, info.filename, data, info.filename.endswith(stored_ext))
        with open(dex, "rb") as fh:
            add(out, "classes.dex", fh.read(), False)
        for name, path in extra:
            with open(path, "rb") as fh:
                add(out, name, fh.read(), name.endswith(stored_ext))
    print("packaged -> %s" % out_path)


if __name__ == "__main__":
    main()
