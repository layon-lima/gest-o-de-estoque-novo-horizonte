from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha256
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import socket
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urljoin, urlparse
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)

from pydantic import BaseModel

from app.api.auth import get_current_user
from app.models import User


router = APIRouter(
    prefix="/api/files",
    tags=["Arquivos"],
)


UPLOAD_DIR = (
    Path(__file__).resolve()
    .parents[2]
    / "uploads"
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


MAX_UPLOAD_BYTES = (
    50 * 1024 * 1024
)

CHUNK_SIZE = (
    1024 * 1024
)


ALLOWED_TYPES = {
    ".jpg": {
        "image/jpeg",
        "image/pjpeg",
    },
    ".jpeg": {
        "image/jpeg",
        "image/pjpeg",
    },
    ".png": {
        "image/png",
    },
    ".webp": {
        "image/webp",
    },
    ".gif": {
        "image/gif",
    },
    ".heic": {
        "image/heic",
        "image/heif",
        "application/octet-stream",
    },
    ".heif": {
        "image/heic",
        "image/heif",
        "application/octet-stream",
    },
    ".pdf": {
        "application/pdf",
    },
    ".xls": {
        "application/vnd.ms-excel",
        "application/octet-stream",
    },
    ".xlsx": {
        (
            "application/vnd.openxmlformats-"
            "officedocument.spreadsheetml.sheet"
        ),
        "application/octet-stream",
    },
    ".csv": {
        "text/csv",
        "application/csv",
        "text/plain",
        "application/vnd.ms-excel",
    },
}


def _validar_tipo(
    file: UploadFile,
) -> str:
    extensao = Path(
        file.filename or ""
    ).suffix.lower()

    if (
        extensao
        not in ALLOWED_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Tipo de arquivo não permitido. "
                "Use imagem, PDF, XLS/XLSX ou CSV."
            ),
        )

    content_type = (
        file.content_type or ""
    ).lower().strip()

    if (
        content_type
        and content_type
        not in ALLOWED_TYPES[
            extensao
        ]
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "O conteúdo informado não "
                "corresponde ao tipo de "
                "arquivo permitido."
            ),
        )

    return extensao


def _assinatura_valida(
    extensao: str,
    inicio: bytes,
) -> bool:
    if extensao in {
        ".jpg",
        ".jpeg",
    }:
        return inicio.startswith(
            b"\xff\xd8\xff"
        )

    if extensao == ".png":
        return inicio.startswith(
            b"\x89PNG\r\n\x1a\n"
        )

    if extensao == ".gif":
        return (
            inicio.startswith(
                b"GIF87a"
            )
            or inicio.startswith(
                b"GIF89a"
            )
        )

    if extensao == ".webp":
        return (
            len(inicio) >= 12
            and inicio[:4] == b"RIFF"
            and inicio[8:12]
            == b"WEBP"
        )

    if extensao == ".pdf":
        return inicio.startswith(
            b"%PDF-"
        )

    # HEIC/HEIF e planilhas podem ter
    # estruturas variadas. Para elas,
    # extensão + MIME já foram validados.
    return True


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    _: User = Depends(
        get_current_user
    ),
):
    extensao = _validar_tipo(
        file
    )

    nome_arquivo = (
        f"{uuid4()}{extensao}"
    )

    destino = (
        UPLOAD_DIR
        / nome_arquivo
    )

    total = 0
    inicio = b""

    try:
        with destino.open("wb") as out:
            while True:
                chunk = await file.read(
                    CHUNK_SIZE
                )

                if not chunk:
                    break

                if not inicio:
                    inicio = (
                        chunk[:32]
                    )

                total += len(chunk)

                if (
                    total
                    > MAX_UPLOAD_BYTES
                ):
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Arquivo muito grande. "
                            "Limite: 50 MB."
                        ),
                    )

                out.write(chunk)

        if total <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Arquivo vazio."
                ),
            )

        if not _assinatura_valida(
            extensao,
            inicio,
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Conteúdo do arquivo "
                    "inválido para a extensão "
                    "informada."
                ),
            )

    except Exception:
        destino.unlink(
            missing_ok=True
        )
        raise

    finally:
        await file.close()

    # URL relativa funciona tanto no computador quanto em celulares na rede.
    # Uma URL absoluta gravaria o host usado no upload (muitas vezes
    # localhost), tornando a imagem inacessível nos outros dispositivos.
    file_url = f"/uploads/{nome_arquivo}"

    return {
        "file_url": file_url,
        "filename": nome_arquivo,
        "size_bytes": total,
    }

IMAGE_SEARCH_MAX_RESULTS = 24
IMAGE_SEARCH_MAX_HTML_BYTES = 3 * 1024 * 1024
IMAGE_PAGE_MAX_HTML_BYTES = 2 * 1024 * 1024
IMAGE_SEARCH_PAGE_LIMIT = 8
IMAGE_SEARCH_PREVIEW_LIMIT = 16
IMAGE_SEARCH_PREVIEW_BYTES = 6 * 1024 * 1024
IMAGE_SEARCH_CACHE_SECONDS = 24 * 60 * 60
IMAGE_IMPORT_MAX_BYTES = 12 * 1024 * 1024
IMAGE_IMPORT_CHUNK_SIZE = 256 * 1024

IMAGE_SEARCH_CACHE_DIR = (
    UPLOAD_DIR
    / "_image_search_cache"
)

IMAGE_SEARCH_CACHE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/154.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
}


class ImportImagePayload(BaseModel):
    url: str
    source_url: str | None = None


def _normalizar_url_web(
    value: str | None,
) -> str:
    texto = str(
        value or ""
    ).strip()

    if texto.startswith("//"):
        return f"https:{texto}"

    return texto


class _BingImagesParser(
    HTMLParser
):
    def __init__(self):
        super().__init__(
            convert_charrefs=True
        )
        self.results: list[
            dict[str, str]
        ] = []
        self._seen: set[
            str
        ] = set()

    def handle_starttag(
        self,
        tag: str,
        attrs,
    ):
        if tag.lower() != "a":
            return

        values = dict(attrs)
        classes = set(
            str(
                values.get(
                    "class"
                )
                or ""
            ).split()
        )

        if "iusc" not in classes:
            return

        raw_meta = values.get(
            "m"
        )

        if not raw_meta:
            return

        try:
            meta = json.loads(
                raw_meta
            )
        except (
            TypeError,
            ValueError,
        ):
            return

        image_url = (
            _normalizar_url_web(
                meta.get("murl")
            )
        )

        if (
            not image_url
            or image_url
            in self._seen
        ):
            return

        thumbnail_url = (
            _normalizar_url_web(
                meta.get("turl")
            )
            or image_url
        )

        source_url = (
            _normalizar_url_web(
                meta.get("purl")
            )
        )

        title = str(
            meta.get("t")
            or meta.get("desc")
            or ""
        ).strip()

        self._seen.add(
            image_url
        )

        self.results.append({
            "image_url":
                image_url,
            "thumbnail_url":
                thumbnail_url,
            "source_url":
                source_url,
            "title":
                title,
        })


def _host_publico(
    hostname: str,
):
    host = str(
        hostname or ""
    ).strip().lower()

    if (
        not host
        or host == "localhost"
        or host.endswith(
            ".localhost"
        )
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Endereço de imagem inválido."
            ),
        )

    try:
        infos = socket.getaddrinfo(
            host,
            None,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Não foi possível resolver "
                "o endereço da imagem."
            ),
        ) from exc

    if not infos:
        raise HTTPException(
            status_code=400,
            detail=(
                "Endereço de imagem inválido."
            ),
        )

    for info in infos:
        endereco = (
            str(
                info[4][0]
            )
            .split("%", 1)[0]
        )

        try:
            ip = ipaddress.ip_address(
                endereco
            )
        except ValueError:
            continue

        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Endereço de imagem "
                    "não permitido."
                ),
            )


def _validar_url_publica(
    url: str,
) -> str:
    texto = str(
        url or ""
    ).strip()

    try:
        parsed = urlparse(
            texto
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="URL de imagem inválida.",
        ) from exc

    if (
        parsed.scheme
        not in {
            "http",
            "https",
        }
        or not parsed.hostname
    ):
        raise HTTPException(
            status_code=400,
            detail="URL de imagem inválida.",
        )

    _host_publico(
        parsed.hostname
    )

    return texto


class _SemRedirect(
    HTTPRedirectHandler
):
    def redirect_request(
        self,
        req,
        fp,
        code,
        msg,
        headers,
        newurl,
    ):
        return None


def _abrir_url_publica(
    url: str,
    *,
    source_url: str | None = None,
):
    atual = _validar_url_publica(
        url
    )

    opener = build_opener(
        _SemRedirect
    )

    headers = dict(
        _BROWSER_HEADERS
    )
    headers["Accept"] = (
        "image/avif,image/webp,"
        "image/apng,image/*,*/*;q=0.8"
    )

    referer = str(
        source_url or ""
    ).strip()

    if referer.startswith(
        ("http://", "https://")
    ):
        headers["Referer"] = referer

    for _ in range(5):
        req = Request(
            atual,
            headers=headers,
        )

        try:
            response = opener.open(
                req,
                timeout=12,
            )
            final_url = str(
                response.geturl()
                or atual
            )

            _validar_url_publica(
                final_url
            )

            return response

        except HTTPError as exc:
            if exc.code not in {
                301,
                302,
                303,
                307,
                308,
            }:
                raise

            location = exc.headers.get(
                "Location"
            )

            if not location:
                raise

            atual = _validar_url_publica(
                urljoin(
                    atual,
                    location,
                )
            )

    raise HTTPException(
        status_code=400,
        detail=(
            "A imagem possui redirecionamentos "
            "demais."
        ),
    )


def _detectar_imagem(
    inicio: bytes,
) -> tuple[str, str] | None:
    if inicio.startswith(
        b"\xff\xd8\xff"
    ):
        return (
            ".jpg",
            "image/jpeg",
        )

    if inicio.startswith(
        b"\x89PNG\r\n\x1a\n"
    ):
        return (
            ".png",
            "image/png",
        )

    if (
        inicio.startswith(
            b"GIF87a"
        )
        or inicio.startswith(
            b"GIF89a"
        )
    ):
        return (
            ".gif",
            "image/gif",
        )

    if (
        len(inicio) >= 12
        and inicio[:4]
        == b"RIFF"
        and inicio[8:12]
        == b"WEBP"
    ):
        return (
            ".webp",
            "image/webp",
        )

    return None


SEARCH_STOPWORDS = {
    "a",
    "as",
    "com",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "imagem",
    "o",
    "os",
    "para",
    "peca",
    "produto",
    "sem",
}


def _normalizar_texto_busca(
    value: str | None,
) -> str:
    texto = unicodedata.normalize(
        "NFKD",
        str(value or ""),
    )

    texto = "".join(
        char
        for char in texto
        if not unicodedata.combining(
            char
        )
    ).lower()

    return re.sub(
        r"[^a-z0-9]+",
        " ",
        texto,
    ).strip()


def _compactar_texto_busca(
    value: str | None,
) -> str:
    return re.sub(
        r"[^a-z0-9]+",
        "",
        _normalizar_texto_busca(
            value
        ),
    )


def _tokens_busca(
    termo: str,
) -> list[str]:
    tokens: list[str] = []

    for token in (
        _normalizar_texto_busca(
            termo
        ).split()
    ):
        if (
            len(token) < 2
            or token in tokens
        ):
            continue

        tokens.append(
            token
        )

    return tokens


def _codigos_busca(
    termo: str,
) -> list[str]:
    codigos: list[str] = []

    for token in _tokens_busca(
        termo
    ):
        if (
            len(token) >= 5
            and any(
                ch.isalpha()
                for ch in token
            )
            and any(
                ch.isdigit()
                for ch in token
            )
        ):
            codigos.append(
                token
            )

    return codigos


def _palavras_busca(
    termo: str,
) -> list[str]:
    codigos = set(
        _codigos_busca(
            termo
        )
    )

    return [
        token
        for token in _tokens_busca(
            termo
        )
        if (
            token not in codigos
            and token not in SEARCH_STOPWORDS
            and len(token) >= 3
        )
    ]



class _BingWebSearchParser(
    HTMLParser
):
    def __init__(self):
        super().__init__(
            convert_charrefs=True
        )
        self.results: list[
            dict[str, str]
        ] = []
        self._current: dict[str, str] | None = None
        self._in_h2 = False
        self._in_link = False
        self._in_snippet = False
        self._title_parts: list[str] = []
        self._snippet_parts: list[str] = []

    def _finish_current(self):
        if self._current is None:
            return

        url = str(
            self._current.get("url")
            or ""
        ).strip()

        if url.startswith(
            ("http://", "https://")
        ):
            self.results.append({
                "url": url,
                "title": " ".join(
                    self._title_parts
                ).strip(),
                "snippet": " ".join(
                    self._snippet_parts
                ).strip(),
            })

        self._current = None
        self._title_parts = []
        self._snippet_parts = []
        self._in_h2 = False
        self._in_link = False
        self._in_snippet = False

    def handle_starttag(
        self,
        tag: str,
        attrs,
    ):
        values = dict(attrs)
        lower_tag = tag.lower()

        if lower_tag == "li":
            classes = set(
                str(
                    values.get("class")
                    or ""
                ).split()
            )

            if "b_algo" in classes:
                self._finish_current()
                self._current = {}
                return

        if self._current is None:
            return

        if lower_tag == "h2":
            self._in_h2 = True
            return

        if (
            lower_tag == "a"
            and self._in_h2
            and not self._current.get("url")
        ):
            href = str(
                values.get("href")
                or ""
            ).strip()

            if href.startswith(
                ("http://", "https://")
            ):
                self._current["url"] = href
                self._in_link = True

            return

        if lower_tag == "p":
            self._in_snippet = True

    def handle_endtag(
        self,
        tag: str,
    ):
        lower_tag = tag.lower()

        if lower_tag == "a":
            self._in_link = False
        elif lower_tag == "h2":
            self._in_h2 = False
            self._in_link = False
        elif lower_tag == "p":
            self._in_snippet = False

    def handle_data(
        self,
        data: str,
    ):
        texto = str(
            data or ""
        ).strip()

        if not texto:
            return

        if self._in_link:
            self._title_parts.append(
                texto
            )

        if self._in_snippet:
            self._snippet_parts.append(
                texto
            )

    def finish(self):
        self._finish_current()


def _json_image_values(
    value,
) -> list[str]:
    encontrados: list[str] = []

    def walk(
        current,
        key: str = "",
    ):
        if isinstance(
            current,
            dict,
        ):
            for (
                child_key,
                child_value,
            ) in current.items():
                normalized = str(
                    child_key
                ).lower()

                if normalized in {
                    "image",
                    "images",
                    "contenturl",
                    "thumbnailurl",
                }:
                    walk(
                        child_value,
                        normalized,
                    )
                elif isinstance(
                    child_value,
                    (dict, list),
                ):
                    walk(
                        child_value,
                        normalized,
                    )

            return

        if isinstance(
            current,
            list,
        ):
            for item in current:
                walk(
                    item,
                    key,
                )
            return

        if isinstance(
            current,
            str,
        ):
            texto = current.strip()

            if (
                key in {
                    "image",
                    "images",
                    "contenturl",
                    "thumbnailurl",
                }
                and texto.startswith(
                    (
                        "http://",
                        "https://",
                        "//",
                        "/",
                    )
                )
            ):
                encontrados.append(
                    texto
                )

    walk(value)

    return encontrados


class _ProductPageParser(
    HTMLParser
):
    def __init__(
        self,
        base_url: str,
    ):
        super().__init__(
            convert_charrefs=True
        )
        self.base_url = base_url
        self.page_title = ""
        self._capture_title = False
        self._title_parts: list[str] = []
        self._json_script = False
        self._json_parts: list[str] = []
        self.candidates: list[
            dict[str, object]
        ] = []

    def _add_candidate(
        self,
        raw_url: str | None,
        *,
        kind: str,
        label: str = "",
        width: int | None = None,
        height: int | None = None,
    ):
        value = _normalizar_url_web(
            raw_url
        )

        if not value:
            return

        resolved = urljoin(
            self.base_url,
            value,
        )

        if not resolved.startswith(
            ("http://", "https://")
        ):
            return

        self.candidates.append({
            "image_url": resolved,
            "kind": kind,
            "label": str(
                label or ""
            ).strip(),
            "width": width,
            "height": height,
        })

    def handle_starttag(
        self,
        tag: str,
        attrs,
    ):
        lower_tag = tag.lower()
        values = dict(attrs)

        if lower_tag == "title":
            self._capture_title = True
            return

        if lower_tag == "meta":
            key = str(
                values.get("property")
                or values.get("name")
                or values.get("itemprop")
                or ""
            ).strip().lower()

            if key in {
                "og:image",
                "og:image:url",
                "og:image:secure_url",
                "twitter:image",
                "twitter:image:src",
                "image",
            }:
                self._add_candidate(
                    values.get("content"),
                    kind=(
                        "og"
                        if key.startswith("og:")
                        else (
                            "twitter"
                            if key.startswith("twitter:")
                            else "meta"
                        )
                    ),
                )

            return

        if lower_tag == "link":
            rel = str(
                values.get("rel")
                or ""
            ).lower()

            if "image_src" in rel:
                self._add_candidate(
                    values.get("href"),
                    kind="link",
                )

            return

        if lower_tag == "script":
            script_type = str(
                values.get("type")
                or ""
            ).lower()

            if "ld+json" in script_type:
                self._json_script = True
                self._json_parts = []

            return

        if lower_tag != "img":
            return

        raw_src = (
            values.get("data-original")
            or values.get("data-lazy-src")
            or values.get("data-src")
            or values.get("src")
        )

        if not raw_src:
            srcset = str(
                values.get("data-srcset")
                or values.get("srcset")
                or ""
            ).strip()

            if srcset:
                raw_src = (
                    srcset.split(",")[0]
                    .strip()
                    .split(" ")[0]
                )

        label = " ".join(
            part
            for part in (
                str(
                    values.get("alt")
                    or ""
                ).strip(),
                str(
                    values.get("title")
                    or ""
                ).strip(),
            )
            if part
        )

        def int_attr(
            name: str,
        ) -> int | None:
            raw = str(
                values.get(name)
                or ""
            ).strip()

            match = re.match(
                r"(\d+)",
                raw,
            )

            return (
                int(match.group(1))
                if match
                else None
            )

        self._add_candidate(
            raw_src,
            kind="img",
            label=label,
            width=int_attr("width"),
            height=int_attr("height"),
        )

    def handle_endtag(
        self,
        tag: str,
    ):
        lower_tag = tag.lower()

        if lower_tag == "title":
            self._capture_title = False
            self.page_title = " ".join(
                self._title_parts
            ).strip()
            return

        if (
            lower_tag == "script"
            and self._json_script
        ):
            self._json_script = False
            raw = "".join(
                self._json_parts
            ).strip()
            self._json_parts = []

            if not raw:
                return

            try:
                data = json.loads(raw)
            except (
                TypeError,
                ValueError,
            ):
                return

            for image_value in (
                _json_image_values(data)
            ):
                self._add_candidate(
                    image_value,
                    kind="jsonld",
                )

    def handle_data(
        self,
        data: str,
    ):
        if self._capture_title:
            texto = str(
                data or ""
            ).strip()

            if texto:
                self._title_parts.append(
                    texto
                )

        if self._json_script:
            self._json_parts.append(
                data
            )


def _abrir_html_publico(
    url: str,
    *,
    timeout: int = 8,
):
    atual = _validar_url_publica(
        url
    )

    opener = build_opener(
        _SemRedirect
    )

    headers = {
        **_BROWSER_HEADERS,
        "Accept": (
            "text/html,application/xhtml+xml,"
            "application/xml;q=0.9,*/*;q=0.8"
        ),
    }

    for _ in range(5):
        req = Request(
            atual,
            headers=headers,
        )

        try:
            response = opener.open(
                req,
                timeout=timeout,
            )

            final_url = str(
                response.geturl()
                or atual
            )

            _validar_url_publica(
                final_url
            )

            return response

        except HTTPError as exc:
            if exc.code not in {
                301,
                302,
                303,
                307,
                308,
            }:
                raise

            location = exc.headers.get(
                "Location"
            )

            if not location:
                raise

            atual = _validar_url_publica(
                urljoin(
                    atual,
                    location,
                )
            )

    raise HTTPException(
        status_code=400,
        detail=(
            "A página possui redirecionamentos "
            "demais."
        ),
    )


def _buscar_bing_paginas(
    consulta: str,
) -> list[dict[str, str]]:
    search_url = (
        "https://www.bing.com/search"
        f"?q={quote_plus(consulta)}"
        "&count=20"
        "&cc=br&setlang=pt-BR"
    )

    req = Request(
        search_url,
        headers={
            **_BROWSER_HEADERS,
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,*/*;q=0.8"
            ),
        },
    )

    opener = build_opener()

    with opener.open(
        req,
        timeout=10,
    ) as response:
        raw = response.read(
            IMAGE_SEARCH_MAX_HTML_BYTES
            + 1
        )

    if (
        len(raw)
        > IMAGE_SEARCH_MAX_HTML_BYTES
    ):
        raw = raw[
            :IMAGE_SEARCH_MAX_HTML_BYTES
        ]

    parser = _BingWebSearchParser()
    parser.feed(
        raw.decode(
            "utf-8",
            errors="ignore",
        )
    )
    parser.finish()

    return parser.results


def _consultas_paginas(
    termo: str,
) -> list[str]:
    codigos = _codigos_busca(
        termo
    )
    palavras = _palavras_busca(
        termo
    )

    consultas: list[str] = []

    if codigos:
        codigo = " ".join(
            f'"{item}"'
            for item in codigos
        )
        complemento = " ".join(
            palavras[:5]
        )

        if complemento:
            consultas.append(
                f"{codigo} {complemento}"
            )

        consultas.append(
            codigo
        )
    else:
        consultas.append(
            termo
        )

    return list(
        dict.fromkeys(
            item.strip()
            for item in consultas
            if item.strip()
        )
    )


def _pontuar_pagina_produto(
    item: dict[str, str],
    termo: str,
) -> int | None:
    title = _normalizar_texto_busca(
        item.get("title")
    )
    snippet = _normalizar_texto_busca(
        item.get("snippet")
    )
    url_text = _normalizar_texto_busca(
        item.get("url")
    )

    haystack = " ".join(
        part
        for part in (
            title,
            snippet,
            url_text,
        )
        if part
    )
    compacto = _compactar_texto_busca(
        haystack
    )

    codigos = _codigos_busca(
        termo
    )
    palavras = _palavras_busca(
        termo
    )

    score = 0

    if codigos:
        hits_codigo = sum(
            1
            for codigo in codigos
            if (
                _compactar_texto_busca(
                    codigo
                )
                in compacto
            )
        )

        if hits_codigo <= 0:
            return None

        score += (
            180
            * hits_codigo
        )

    hits_palavra = sum(
        1
        for palavra in palavras
        if re.search(
            rf"\b{re.escape(palavra)}\b",
            haystack,
        )
    )

    if (
        not codigos
        and palavras
        and hits_palavra
        < (
            1
            if len(palavras) <= 1
            else 2
        )
    ):
        return None

    score += (
        12
        * hits_palavra
    )

    path = str(
        urlparse(
            item.get("url")
            or ""
        ).path
        or ""
    ).lower()

    if any(
        marker in path
        for marker in (
            "/product",
            "/products",
            "/produto",
            "/produtos",
            "/item",
            "/parts",
            "/part/",
            "/p/",
            "/peca",
        )
    ):
        score += 25

    host = str(
        urlparse(
            item.get("url")
            or ""
        ).hostname
        or ""
    ).lower()

    if any(
        blocked in host
        for blocked in (
            "facebook.",
            "instagram.",
            "pinterest.",
            "youtube.",
            "tiktok.",
        )
    ):
        score -= 60

    return score


_IMAGE_BAD_WORDS = {
    "avatar",
    "badge",
    "banner",
    "favicon",
    "flag",
    "icon",
    "logo",
    "payment",
    "placeholder",
    "sprite",
    "trust",
}


def _pontuar_imagem_pagina(
    candidate: dict[str, object],
    *,
    termo: str,
    page_score: int,
    page_title: str,
) -> int | None:
    image_url = str(
        candidate.get("image_url")
        or ""
    ).strip()

    if (
        not image_url
        or image_url.lower().endswith(
            ".svg"
        )
    ):
        return None

    label = _normalizar_texto_busca(
        candidate.get("label")
    )
    image_text = _normalizar_texto_busca(
        image_url
    )
    page_text = _normalizar_texto_busca(
        page_title
    )

    candidate_text = " ".join(
        (
            label,
            image_text,
            page_text,
        )
    )
    compact = _compactar_texto_busca(
        candidate_text
    )

    lowered_url = image_url.lower()

    if any(
        word in lowered_url
        for word in _IMAGE_BAD_WORDS
    ):
        return None

    width = candidate.get("width")
    height = candidate.get("height")

    if (
        isinstance(width, int)
        and isinstance(height, int)
        and (
            width < 120
            or height < 120
        )
    ):
        return None

    kind = str(
        candidate.get("kind")
        or ""
    )

    score = page_score + {
        "jsonld": 60,
        "og": 55,
        "twitter": 45,
        "meta": 35,
        "link": 25,
        "img": 10,
    }.get(
        kind,
        0,
    )

    for codigo in _codigos_busca(
        termo
    ):
        if (
            _compactar_texto_busca(
                codigo
            )
            in compact
        ):
            score += 100

    for palavra in _palavras_busca(
        termo
    ):
        if re.search(
            rf"\b{re.escape(palavra)}\b",
            candidate_text,
        ):
            score += 7

    if (
        isinstance(width, int)
        and isinstance(height, int)
        and width >= 300
        and height >= 300
    ):
        score += 10

    return score


def _extrair_imagens_pagina(
    page: dict[str, object],
    termo: str,
) -> list[dict[str, object]]:
    url = str(
        page.get("url")
        or ""
    ).strip()

    page_score = int(
        page.get("_score")
        or 0
    )

    try:
        response = _abrir_html_publico(
            url
        )

        with response:
            content_type = str(
                response.headers.get(
                    "Content-Type"
                )
                or ""
            ).lower()

            if (
                content_type
                and "html" not in content_type
                and "xhtml" not in content_type
            ):
                return []

            raw = response.read(
                IMAGE_PAGE_MAX_HTML_BYTES
                + 1
            )

            final_url = str(
                response.geturl()
                or url
            )

            charset = (
                response.headers.get_content_charset()
                or "utf-8"
            )

    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        HTTPException,
        ValueError,
    ):
        return []

    if (
        len(raw)
        > IMAGE_PAGE_MAX_HTML_BYTES
    ):
        raw = raw[
            :IMAGE_PAGE_MAX_HTML_BYTES
        ]

    parser = _ProductPageParser(
        final_url
    )

    try:
        parser.feed(
            raw.decode(
                charset,
                errors="ignore",
            )
        )
    except Exception:
        return []

    page_title = (
        parser.page_title
        or str(
            page.get("title")
            or ""
        )
    )

    melhores: dict[
        str,
        dict[str, object],
    ] = {}

    for candidate in (
        parser.candidates
    ):
        score = _pontuar_imagem_pagina(
            candidate,
            termo=termo,
            page_score=page_score,
            page_title=page_title,
        )

        if score is None:
            continue

        image_url = str(
            candidate.get("image_url")
            or ""
        ).strip()

        existing = melhores.get(
            image_url
        )

        item = {
            "image_url": image_url,
            "thumbnail_url": image_url,
            "source_url": final_url,
            "title": (
                str(
                    candidate.get("label")
                    or ""
                ).strip()
                or page_title
                or str(
                    page.get("title")
                    or ""
                ).strip()
            ),
            "_score": score,
        }

        if (
            existing is None
            or score
            > int(
                existing.get("_score")
                or 0
            )
        ):
            melhores[
                image_url
            ] = item

    return sorted(
        melhores.values(),
        key=lambda item: int(
            item.get("_score")
            or 0
        ),
        reverse=True,
    )[:6]


def _buscar_imagens_paginas_produto(
    termo: str,
) -> list[dict[str, object]]:
    paginas: dict[
        str,
        dict[str, object],
    ] = {}

    for consulta in _consultas_paginas(
        termo
    ):
        try:
            resultados = _buscar_bing_paginas(
                consulta
            )
        except (
            HTTPError,
            URLError,
            TimeoutError,
            OSError,
            ValueError,
        ):
            continue

        for item in resultados:
            score = _pontuar_pagina_produto(
                item,
                termo,
            )

            if score is None:
                continue

            url = str(
                item.get("url")
                or ""
            ).strip()

            if not url:
                continue

            current = paginas.get(url)

            enriched = {
                **item,
                "_score": score,
            }

            if (
                current is None
                or score
                > int(
                    current.get("_score")
                    or 0
                )
            ):
                paginas[
                    url
                ] = enriched

        if len(
            paginas
        ) >= IMAGE_SEARCH_PAGE_LIMIT:
            break

    melhores_paginas = sorted(
        paginas.values(),
        key=lambda item: int(
            item.get("_score")
            or 0
        ),
        reverse=True,
    )[:IMAGE_SEARCH_PAGE_LIMIT]

    encontrados: list[
        dict[str, object]
    ] = []

    with ThreadPoolExecutor(
        max_workers=5
    ) as executor:
        futures = [
            executor.submit(
                _extrair_imagens_pagina,
                page,
                termo,
            )
            for page in melhores_paginas
        ]

        for future in as_completed(
            futures
        ):
            try:
                encontrados.extend(
                    future.result()
                )
            except Exception:
                continue

    unique: dict[
        str,
        dict[str, object],
    ] = {}

    for item in encontrados:
        url = str(
            item.get("image_url")
            or ""
        ).strip()

        if not url:
            continue

        current = unique.get(url)

        if (
            current is None
            or int(
                item.get("_score")
                or 0
            )
            > int(
                current.get("_score")
                or 0
            )
        ):
            unique[
                url
            ] = item

    return sorted(
        unique.values(),
        key=lambda item: int(
            item.get("_score")
            or 0
        ),
        reverse=True,
    )


def _limpar_cache_busca_imagens():
    limite = (
        time.time()
        - IMAGE_SEARCH_CACHE_SECONDS
    )

    try:
        arquivos = list(
            IMAGE_SEARCH_CACHE_DIR.iterdir()
        )
    except OSError:
        return

    for arquivo in arquivos:
        try:
            if (
                arquivo.is_file()
                and arquivo.stat().st_mtime
                < limite
            ):
                arquivo.unlink(
                    missing_ok=True
                )
        except OSError:
            continue


def _cachear_preview_resultado(
    item: dict[str, object],
) -> dict[str, object] | None:
    image_url = str(
        item.get("image_url")
        or ""
    ).strip()

    if not image_url:
        return None

    digest = sha256(
        image_url.encode(
            "utf-8",
            errors="ignore",
        )
    ).hexdigest()[:32]

    try:
        response = _abrir_url_publica(
            image_url,
            source_url=str(
                item.get("source_url")
                or ""
            ),
        )
    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        HTTPException,
        ValueError,
    ):
        return None

    total = 0
    inicio = b""
    chunks: list[bytes] = []

    try:
        with response:
            while True:
                chunk = response.read(
                    256 * 1024
                )

                if not chunk:
                    break

                if not inicio:
                    inicio = chunk[:32]

                total += len(chunk)

                if (
                    total
                    > IMAGE_SEARCH_PREVIEW_BYTES
                ):
                    return None

                chunks.append(chunk)

    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
    ):
        return None

    detectada = _detectar_imagem(
        inicio
    )

    if detectada is None:
        return None

    extensao, _mime = detectada

    cache_path = (
        IMAGE_SEARCH_CACHE_DIR
        / f"{digest}{extensao}"
    )

    if not cache_path.exists():
        temp_path = (
            IMAGE_SEARCH_CACHE_DIR
            / f".{digest}.tmp"
        )

        try:
            with temp_path.open(
                "wb"
            ) as out:
                for chunk in chunks:
                    out.write(chunk)

            temp_path.replace(
                cache_path
            )
        except OSError:
            temp_path.unlink(
                missing_ok=True
            )
            return None

    result = dict(item)
    result["thumbnail_url"] = (
        "/uploads/_image_search_cache/"
        f"{cache_path.name}"
    )
    result.pop("_score", None)

    return result


def _preparar_previews_busca(
    items: list[dict[str, object]],
) -> list[dict[str, object]]:
    _limpar_cache_busca_imagens()

    candidates = items[
        :IMAGE_SEARCH_PREVIEW_LIMIT
    ]

    if not candidates:
        return []

    indexed_results: dict[
        int,
        dict[str, object],
    ] = {}

    with ThreadPoolExecutor(
        max_workers=6
    ) as executor:
        futures = {
            executor.submit(
                _cachear_preview_resultado,
                item,
            ): index
            for (
                index,
                item,
            ) in enumerate(
                candidates
            )
        }

        for future in as_completed(
            futures
        ):
            index = futures[
                future
            ]

            try:
                result = future.result()
            except Exception:
                result = None

            if result is not None:
                indexed_results[
                    index
                ] = result

    return [
        indexed_results[
            index
        ]
        for index in sorted(
            indexed_results
        )
    ]


def _consultas_bing(
    termo: str,
) -> list[tuple[str, int]]:
    codigos = _codigos_busca(
        termo
    )
    palavras = _palavras_busca(
        termo
    )

    consultas: list[
        tuple[str, int]
    ] = []

    if codigos:
        codigo_exato = " ".join(
            f'"{codigo}"'
            for codigo in codigos
        )

        complemento = " ".join(
            palavras[:5]
        )

        # Código exato primeiro: é a consulta mais confiável para peças.
        consultas.append(
            (
                codigo_exato,
                90,
            )
        )

        if complemento:
            consultas.append(
                (
                    f"{codigo_exato} {complemento}",
                    70,
                )
            )

        # Não usa a frase ampla quando há código:
        # evita resultados genéricos e completamente fora do contexto.
    else:
        consultas.append(
            (
                termo,
                0,
            )
        )

    resultado: list[
        tuple[str, int]
    ] = []
    vistos: set[str] = set()

    for (
        consulta,
        bonus_origem,
    ) in consultas:
        consulta = str(
            consulta or ""
        ).strip()

        if (
            not consulta
            or consulta in vistos
        ):
            continue

        vistos.add(
            consulta
        )
        resultado.append(
            (
                consulta,
                bonus_origem,
            )
        )

    return resultado


def _buscar_bing_imagens(
    consulta: str,
) -> list[dict[str, str]]:
    search_url = (
        "https://www.bing.com/images/search"
        f"?q={quote_plus(consulta)}"
        "&form=HDRSC3&first=1"
        "&cc=br&setlang=pt-BR"
    )

    req = Request(
        search_url,
        headers={
            **_BROWSER_HEADERS,
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,*/*;q=0.8"
            ),
        },
    )

    opener = build_opener()

    with opener.open(
        req,
        timeout=10,
    ) as response:
        raw = response.read(
            IMAGE_SEARCH_MAX_HTML_BYTES
            + 1
        )

    if (
        len(raw)
        > IMAGE_SEARCH_MAX_HTML_BYTES
    ):
        raw = raw[
            :IMAGE_SEARCH_MAX_HTML_BYTES
        ]

    parser = _BingImagesParser()

    parser.feed(
        raw.decode(
            "utf-8",
            errors="ignore",
        )
    )

    return parser.results


def _pontuar_resultado_imagem(
    item: dict[str, str],
    termo: str,
    *,
    bonus_origem: int = 0,
) -> int | None:
    codigos = _codigos_busca(
        termo
    )
    palavras = _palavras_busca(
        termo
    )

    titulo = _normalizar_texto_busca(
        item.get("title")
    )
    origem = _normalizar_texto_busca(
        item.get("source_url")
    )
    imagem = _normalizar_texto_busca(
        item.get("image_url")
    )

    haystack = " ".join(
        part
        for part in (
            titulo,
            origem,
            imagem,
        )
        if part
    )

    compacto = _compactar_texto_busca(
        haystack
    )

    score = int(
        bonus_origem
        or 0
    )

    if codigos:
        hits_codigo = sum(
            1
            for codigo in codigos
            if (
                _compactar_texto_busca(
                    codigo
                )
                in compacto
            )
        )

        if hits_codigo > 0:
            score += (
                120
                * hits_codigo
            )

        # Em consultas de código exato, o próprio mecanismo de busca
        # é a principal evidência. Bing nem sempre repete o código
        # no título/URL da imagem, então não descartamos só por isso.
        elif bonus_origem <= 0:
            return None

    hits_palavra = sum(
        1
        for palavra in palavras
        if re.search(
            rf"\b{re.escape(palavra)}\b",
            haystack,
        )
    )

    if not codigos:
        minimo = (
            1
            if len(palavras) <= 1
            else 2
        )

        if (
            palavras
            and hits_palavra
            < minimo
        ):
            return None

    score += (
        8
        * hits_palavra
    )

    # Resultado cujo título repete o código/nome tende a ser página de produto.
    titulo_compacto = (
        _compactar_texto_busca(
            titulo
        )
    )

    if codigos and any(
        _compactar_texto_busca(
            codigo
        )
        in titulo_compacto
        for codigo in codigos
    ):
        score += 30

    if palavras:
        hits_titulo = sum(
            1
            for palavra in palavras
            if re.search(
                rf"\b{re.escape(palavra)}\b",
                titulo,
            )
        )

        score += (
            5
            * hits_titulo
        )

    return score


@router.get(
    "/image-search"
)
def buscar_imagens_produto(
    q: str = Query(
        ...,
        min_length=2,
        max_length=180,
    ),
    _: User = Depends(
        get_current_user
    ),
):
    termo = str(
        q or ""
    ).strip()

    if len(termo) < 2:
        raise HTTPException(
            status_code=400,
            detail=(
                "Digite pelo menos 2 caracteres "
                "para pesquisar."
            ),
        )

    # Motor principal:
    # 1) procura páginas reais do produto;
    # 2) valida código/nome;
    # 3) extrai imagem principal/JSON-LD;
    # 4) valida e cacheia a imagem antes de exibir.
    encontrados = (
        _buscar_imagens_paginas_produto(
            termo
        )
    )

    # Fallback: só entra quando o motor de páginas encontrou pouco.
    # Aqui mantemos filtro estrito para evitar imagens sem relação.
    if len(encontrados) < 6:
        codigos = _codigos_busca(
            termo
        )
        fallback: dict[
            str,
            dict[str, object],
        ] = {}

        for (
            consulta,
            bonus_origem,
        ) in _consultas_bing(
            termo
        ):
            try:
                resultados = _buscar_bing_imagens(
                    consulta
                )
            except (
                HTTPError,
                URLError,
                TimeoutError,
                OSError,
                ValueError,
            ):
                continue

            for item in resultados:
                image_url = str(
                    item.get("image_url")
                    or ""
                ).strip()

                if not image_url:
                    continue

                if codigos:
                    metadata = _compactar_texto_busca(
                        " ".join(
                            (
                                str(
                                    item.get("title")
                                    or ""
                                ),
                                str(
                                    item.get("source_url")
                                    or ""
                                ),
                                image_url,
                            )
                        )
                    )

                    if not any(
                        _compactar_texto_busca(
                            codigo
                        )
                        in metadata
                        for codigo in codigos
                    ):
                        continue

                score = _pontuar_resultado_imagem(
                    item,
                    termo,
                    bonus_origem=bonus_origem,
                )

                if score is None:
                    continue

                current = fallback.get(
                    image_url
                )

                enriched = {
                    **item,
                    "_score": (
                        int(score)
                        - 30
                    ),
                }

                if (
                    current is None
                    or int(
                        enriched["_score"]
                    )
                    > int(
                        current.get("_score")
                        or 0
                    )
                ):
                    fallback[
                        image_url
                    ] = enriched

        encontrados.extend(
            sorted(
                fallback.values(),
                key=lambda item: int(
                    item.get("_score")
                    or 0
                ),
                reverse=True,
            )
        )

    unique: dict[
        str,
        dict[str, object],
    ] = {}

    for item in encontrados:
        image_url = str(
            item.get("image_url")
            or ""
        ).strip()

        if not image_url:
            continue

        current = unique.get(
            image_url
        )

        if (
            current is None
            or int(
                item.get("_score")
                or 0
            )
            > int(
                current.get("_score")
                or 0
            )
        ):
            unique[
                image_url
            ] = item

    ordered = sorted(
        unique.values(),
        key=lambda item: int(
            item.get("_score")
            or 0
        ),
        reverse=True,
    )

    results = _preparar_previews_busca(
        ordered
    )

    return {
        "query": termo,
        "provider": (
            "Pesquisa de páginas de produto"
        ),
        "results": results[
            :IMAGE_SEARCH_MAX_RESULTS
        ],
    }


@router.post(
    "/import-image"
)
def importar_imagem_web(
    payload: ImportImagePayload,
    _: User = Depends(
        get_current_user
    ),
):
    try:
        response = _abrir_url_publica(
            payload.url,
            source_url=payload.source_url,
        )
    except HTTPException:
        raise
    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
    ) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Não foi possível baixar "
                "a imagem selecionada."
            ),
        ) from exc

    total = 0
    inicio = b""
    temp_path = (
        UPLOAD_DIR
        / f".{uuid4()}.tmp"
    )

    try:
        with response:
            with temp_path.open(
                "wb"
            ) as out:
                while True:
                    chunk = response.read(
                        IMAGE_IMPORT_CHUNK_SIZE
                    )

                    if not chunk:
                        break

                    if not inicio:
                        inicio = (
                            chunk[:32]
                        )

                    total += len(
                        chunk
                    )

                    if (
                        total
                        > IMAGE_IMPORT_MAX_BYTES
                    ):
                        raise HTTPException(
                            status_code=413,
                            detail=(
                                "A imagem encontrada "
                                "é muito grande. "
                                "Limite: 12 MB."
                            ),
                        )

                    out.write(
                        chunk
                    )

        if total <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A imagem selecionada "
                    "está vazia."
                ),
            )

        detectada = _detectar_imagem(
            inicio
        )

        if detectada is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "O resultado selecionado "
                    "não é JPG, PNG, WEBP ou GIF."
                ),
            )

        extensao, _mime = detectada

        nome_arquivo = (
            f"{uuid4()}{extensao}"
        )

        destino = (
            UPLOAD_DIR
            / nome_arquivo
        )

        temp_path.replace(
            destino
        )

    except Exception:
        temp_path.unlink(
            missing_ok=True
        )
        raise

    return {
        "file_url":
            f"/uploads/{nome_arquivo}",
        "filename":
            nome_arquivo,
        "size_bytes":
            total,
        "source_url":
            str(
                payload.source_url
                or ""
            ).strip(),
    }

