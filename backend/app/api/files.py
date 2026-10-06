from __future__ import annotations

from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import socket
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
IMAGE_IMPORT_MAX_BYTES = 12 * 1024 * 1024
IMAGE_IMPORT_CHUNK_SIZE = 256 * 1024

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

    search_url = (
        "https://www.bing.com/images/search"
        f"?q={quote_plus(termo)}"
        "&form=HDRSC3&first=1"
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

    try:
        opener = build_opener()
        with opener.open(
            req,
            timeout=10,
        ) as response:
            raw = response.read(
                IMAGE_SEARCH_MAX_HTML_BYTES
                + 1
            )

    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
    ) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Não foi possível pesquisar "
                "imagens na internet agora."
            ),
        ) from exc

    if (
        len(raw)
        > IMAGE_SEARCH_MAX_HTML_BYTES
    ):
        raw = raw[
            :IMAGE_SEARCH_MAX_HTML_BYTES
        ]

    parser = _BingImagesParser()

    try:
        parser.feed(
            raw.decode(
                "utf-8",
                errors="ignore",
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "A resposta da busca de imagens "
                "não pôde ser interpretada."
            ),
        ) from exc

    return {
        "query": termo,
        "provider": "Bing Imagens",
        "results": parser.results[
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

