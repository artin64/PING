import logging
import shutil
from io import BytesIO
from pathlib import Path

logger = logging.getLogger("pingo.ocr")


def validate_image(content: bytes) -> None:
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = 40_000_000
    try:
        with Image.open(BytesIO(content)) as image:
            if image.width * image.height > Image.MAX_IMAGE_PIXELS:
                raise ValueError("Image dimensions are too large")
            image.verify()
    except Exception as exc:
        raise ValueError("The image could not be decoded") from exc


def read_image_text(path: Path) -> tuple[str, str]:
    """Run local OCR when Tesseract is installed; never represent a missing result as success."""
    if shutil.which("tesseract") is None:
        return "", "not_configured"
    try:
        import pytesseract
        from PIL import Image, ImageOps

        with Image.open(path) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            text = pytesseract.image_to_string(image, lang="eng", timeout=12).strip()
        return text[:50000], "completed" if text else "no_text_found"
    except Exception:
        logger.exception("Local OCR failed")
        return "", "failed"


def validate_pdf(content: bytes) -> None:
    if not content.startswith(b"%PDF-"):
        raise ValueError("The file is not a PDF")
    try:
        import fitz

        document = fitz.open(stream=content, filetype="pdf")
        if document.is_encrypted:
            document.close()
            raise ValueError("Password-protected PDFs are not supported")
        if document.page_count < 1 or document.page_count > 100:
            document.close()
            raise ValueError("PDFs must contain between 1 and 100 pages")
        for page in document:
            if page.rect.width > 20_000 or page.rect.height > 20_000:
                document.close()
                raise ValueError("A PDF page is too large to process")
        document.close()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("The PDF could not be opened") from exc


def read_pdf_text(path: Path) -> tuple[str, str]:
    """Extract PDF text locally, OCRing textless pages only when Tesseract is available."""
    try:
        import fitz

        document = fitz.open(path)
        if document.is_encrypted or document.page_count > 100:
            document.close()
            return "", "failed"
        has_tesseract = shutil.which("tesseract") is not None
        parts: list[str] = []
        ocr_count = 0
        skipped_pages = 0
        for page in document:
            page_text = page.get_text("text").strip()
            if not page_text and has_tesseract and ocr_count < 12:
                try:
                    import pytesseract
                    from PIL import Image

                    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                    page_image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
                    page_text = pytesseract.image_to_string(page_image, lang="eng", timeout=10).strip()
                except Exception:
                    logger.exception("PDF page OCR failed")
                ocr_count += 1
            elif not page_text:
                skipped_pages += 1
            if page_text:
                parts.append(page_text)
        document.close()
        text = "\n\n".join(parts)[:100_000]
        if not text and not has_tesseract:
            return "", "not_configured"
        if skipped_pages:
            return text, "partial" if text else "no_text_found"
        return text, "completed" if text else "no_text_found"
    except Exception:
        logger.exception("Local PDF extraction failed")
        return "", "failed"

