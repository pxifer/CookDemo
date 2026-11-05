"""Offline, hash-pinned source reconstruction. No network, OCR or fact publication."""
from argparse import ArgumentParser
from html.parser import HTMLParser
from importlib.metadata import version
from pathlib import Path
import hashlib
import json
import re
import sys

POLICY = "source-rebuild-v1"
PYPDF_VERSION = "6.21.4"
PDF_DEPENDENCIES = {"pypdf": PYPDF_VERSION, "cryptography": "50.0.2", "cffi": "2.1.1", "pycparser": "3.12", "fonttools": "4.68.0"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def below(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative or ":" in relative:
        raise ValueError("UNSAFE_SOURCE_PATH")
    target = (root / relative).resolve()
    if not target.is_relative_to(root.resolve()) or target == root.resolve():
        raise ValueError("SOURCE_PATH_ESCAPE")
    return target


class HtmlText(HTMLParser):
    """A reproducible baseline, NOT automatic article/body recognition."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, text):
        if not self.skip and text.strip():
            self.parts.append(text.strip())


def html_pages(data):
    # Fail on an unsupported encoding instead of silently replacing damaged characters.
    text = data.decode("utf-8-sig", errors="strict")
    parser = HtmlText()
    parser.feed(text)
    return ["\n".join(parser.parts)]


def immutable_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb") as stream:
            stream.write(data)
    except FileExistsError:
        if path.read_bytes() != data:
            raise ValueError("OUTPUT_CHANGED_USE_NEW_DIRECTORY")


def rebuild(registry, roots, output):
    if sys.version_info[:2] != (3, 11):
        raise ValueError("PYTHON_311_REQUIRED")
    if registry.get("schemaVersion") != 1 or not isinstance(registry.get("sources"), list):
        raise ValueError("SOURCE_REGISTRY_SHAPE")
    output = Path(output).resolve()
    for root in roots.values():
        root = Path(root).resolve()
        if output.is_relative_to(root) or root.is_relative_to(output):
            raise ValueError("OUTPUT_OVERLAPS_SOURCE_CACHE")
    results, seen = [], set()
    for source in registry["sources"]:
        source_id = source.get("id", "")
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{0,100}", source_id) or source_id in seen:
            raise ValueError("SOURCE_ID_INVALID_OR_DUPLICATE")
        seen.add(source_id)
        if source.get("cache") not in roots or source.get("format") not in ("pdf", "html") or not re.fullmatch(r"[a-f0-9]{64}", source.get("sha256", "")):
            raise ValueError("SOURCE_DESCRIPTOR_INVALID")
        root = Path(roots[source["cache"]]).resolve()
        raw = below(root, source["file"])
        try:
            data = raw.read_bytes()
            if digest(data) != source["sha256"]:
                raise ValueError("SOURCE_HASH_MISMATCH")
            assets = []
            for asset in source.get("assets", []):
                asset_bytes = below(root, asset["file"]).read_bytes()
                if digest(asset_bytes) != asset["sha256"]:
                    raise ValueError("VISUAL_ASSET_HASH_MISMATCH")
                assets.append({"file": asset["file"], "sha256": asset["sha256"], "bytes": len(asset_bytes)})
            parser_id = "stdlib-html-text-v1"
            parser_version = sys.version.split()[0]
            dependencies = {}
            if source["format"] == "pdf":
                if not data.startswith(b"%PDF"):
                    raise ValueError("PDF_SIGNATURE_INVALID")
                dependencies = {name: version(name) for name in PDF_DEPENDENCIES}
                if dependencies != PDF_DEPENDENCIES:
                    raise ValueError("PDF_PARSER_DEPENDENCY_VERSION_MISMATCH")
                from pypdf import PdfReader
                pages = [page.extract_text() or "" for page in PdfReader(raw).pages]
                parser_id, parser_version = "pypdf-extract-text", PYPDF_VERSION
            else:
                pages = html_pages(data)
            if source.get("expectedPages") is not None and len(pages) != source["expectedPages"]:
                raise ValueError("PAGE_COUNT_MISMATCH")
            compact = [re.sub(r"\s+", "", page) for page in pages]
            flags = []
            if any(len(page) < 40 for page in compact):
                flags.append("sparse_page_needs_layout_or_ocr_review")
            if assets:
                flags.append("visual_evidence_not_extracted_or_ocr_verified")
            if any("\ufffd" in page for page in pages):
                flags.append("replacement_character_requires_review")
            raw_pages, normalized_pages = encoded(pages), encoded(compact)
            target = output / source_id
            manifest = {"schemaVersion": 1, "id": source_id, "policy": POLICY,
                        "source": {"cache": source["cache"], "file": source["file"], "sha256": digest(data), "bytes": len(data)},
                        "assets": assets, "parser": {"id": parser_id, "version": parser_version, "python": sys.version.split()[0], "dependencies": dependencies, "scriptHash": digest(Path(__file__).read_bytes())},
                        "transform": "page_boundaries_preserved; normalized_copy_removes_unicode_whitespace_only",
                        "outputs": {"pages.json": digest(raw_pages), "normalized-pages.json": digest(normalized_pages)},
                        "pages": len(pages), "pageCharacters": [len(page) for page in compact], "reviewFlags": flags,
                        "quality": {"bodyDetection": False, "tableParsing": False, "ocr": False, "semanticReview": "pending"}}
            immutable_write(target / "pages.json", raw_pages)
            immutable_write(target / "normalized-pages.json", normalized_pages)
            immutable_write(target / "manifest.json", encoded(manifest))
            results.append({"id": source_id, "status": "rebuilt_with_review_flags" if flags else "rebuilt", "manifestHash": digest(encoded(manifest)), "pages": len(pages), "reviewFlags": flags})
        except Exception as error:
            # Parser-specific failures (including missing AES dependencies) are per-source rejects.
            # Never leak exception payloads containing text/absolute paths or invent replacement pages.
            reason = str(error) if isinstance(error, ValueError) and re.fullmatch(r"[A-Z_]+", str(error)) else type(error).__name__
            results.append({"id": source_id, "status": "failed", "reason": reason})
    report = {"schemaVersion": 1, "policy": POLICY, "registryHash": digest(encoded(registry)), "results": results,
              "reproducible": "no timestamps or absolute local paths; compare manifests/output hashes across independent runs",
              "state": "incomplete" if any(row["status"] == "failed" for row in results) else "rebuilt_not_semantically_approved",
              "factsPublished": 0, "networkRequests": 0, "clinicalReview": "pending"}
    immutable_write(output / "rebuild-report.json", encoded(report))
    return report


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--registry", required=True)
    parser.add_argument("--health-cache", required=True)
    parser.add_argument("--goal-cache", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    output = Path(args.output).resolve()
    # Full-source derived text is private/ignored; never write frozen/public datasets.
    if not (output.is_relative_to(project / ".local-data") or output.is_relative_to(project / "artifacts/tmp/health-rebuild")):
        raise ValueError("OUTPUT_MUST_BE_IGNORED_REBUILD_DIRECTORY")
    report = rebuild(json.loads(Path(args.registry).read_text(encoding="utf-8")), {"health": Path(args.health_cache), "goals": Path(args.goal_cache)}, output)
    print(json.dumps(report, ensure_ascii=False))
    return 2 if report["state"] == "incomplete" else 0


if __name__ == "__main__":
    raise SystemExit(main())
