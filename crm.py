"""Lettura delle richieste da Supabase e salvataggio dell'esito nella pratica Notion."""

import os
import re
from datetime import date

import httpx
from loguru import logger

NOTION_VERSION = "2025-09-03"

FORME = {"persona_fisica": None, "ditta_individuale": "Ditta individuale", "srl": "SRL", "altra_societa": "Altra societa"}
TIPI_CLIENTE = {
    "ha_idea": "Ha un idea",
    "senza_idea": "Senza idea",
    "rendita_gestita": "Rendita gestita",
    "azienda_esistente": "Azienda esistente",
}
REGIONI = {"Liguria", "Lombardia", "Piemonte", "Toscana", "Altra Centro-Nord", "Sud", "Estero AIRE"}


def cifre(numero: str | None) -> str:
    """Ultime 9 cifre di un numero, per confrontare +39 347..., 0039 347... e 347 ..."""
    return re.sub(r"\D", "", numero or "")[-9:]


def numero_e164(numero: str) -> str:
    """Numero in formato +39... come lo vuole Twilio."""
    n = re.sub(r"[^\d+]", "", numero)
    if n.startswith("00"):
        n = "+" + n[2:]
    if not n.startswith("+"):
        n = "+39" + n
    return n


def _supabase() -> httpx.AsyncClient:
    chiave = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return httpx.AsyncClient(
        base_url=os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1",
        headers={"apikey": chiave, "Authorization": f"Bearer {chiave}"},
        timeout=10,
    )


CAMPI_CLIENTE = (
    "id,tipo,nome,cognome,ragione_sociale,telefono,email,importo_richiesto,attivita,consenso_privacy_at,created_at"
)


async def carica_cliente(cliente_id: str) -> dict | None:
    async with _supabase() as s:
        r = await s.get("/clients", params={"select": CAMPI_CLIENTE, "id": f"eq.{cliente_id}"})
        r.raise_for_status()
        righe = r.json()
    return righe[0] if righe else None


async def trova_cliente(numero: str | None) -> dict | None:
    """Ultima richiesta inviata da questo numero, se c'è."""
    chiave = cifre(numero)
    if len(chiave) < 8:
        return None
    async with _supabase() as s:
        r = await s.get(
            "/clients",
            params={"select": CAMPI_CLIENTE, "order": "created_at.desc", "limit": "5000"},
        )
        r.raise_for_status()
        righe = r.json()
    return next((c for c in righe if cifre(c.get("telefono")) == chiave), None)


def nome_cliente(cliente: dict | None) -> str | None:
    if not cliente:
        return None
    if cliente.get("tipo") == "azienda" and cliente.get("ragione_sociale"):
        return cliente["ragione_sociale"]
    return " ".join(p for p in (cliente.get("nome"), cliente.get("cognome")) if p) or None


def _notion() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url="https://api.notion.com/v1",
        headers={
            "Authorization": f"Bearer {os.environ['NOTION_TOKEN']}",
            "Notion-Version": NOTION_VERSION,
        },
        timeout=15,
    )


def _testo(t: str) -> list[dict]:
    # Notion accetta al massimo 2000 caratteri per frammento
    return [{"type": "text", "text": {"content": t[i : i + 2000]}} for i in range(0, len(t), 2000)] or [
        {"type": "text", "text": {"content": ""}}
    ]


def _vuota(prop: dict | None) -> bool:
    if not prop:
        return True
    valore = prop.get(prop.get("type"))
    return valore in (None, [], "", False)


async def _trova_pratica(n: httpx.AsyncClient, cliente_id: str) -> dict | None:
    r = await n.post(
        f"/data_sources/{os.environ['NOTION_DATA_SOURCE_ID']}/query",
        json={"filter": {"property": "ID MIA", "rich_text": {"equals": cliente_id}}, "page_size": 1},
    )
    r.raise_for_status()
    risultati = r.json().get("results", [])
    return risultati[0] if risultati else None


async def salva_esito_notion(
    *,
    cliente: dict | None,
    numero: str | None,
    direzione: str,
    esito: dict,
) -> str:
    """Aggiorna (o crea) la pratica in "Pratiche microcredito". Restituisce l'URL della pagina."""
    oggi = date.today().isoformat()
    resoconto = (
        f"Chiamata AI del {oggi} ({'in uscita' if direzione == 'uscita' else 'in entrata'}"
        f", numero {numero or 'nascosto'}, lingua {esito.get('lingua') or 'it'}).\n"
        f"Esito: {esito.get('esito')}.\n"
        f"Attività: {esito.get('attivita') or '-'}. Città: {esito.get('citta') or '-'}.\n"
        f"Importo: {esito.get('importo') or '-'}. Forma: {esito.get('forma') or '-'}. "
        f"CRIF/Centrale Rischi: {esito.get('segnalazioni_crif') or '-'}.\n"
        f"{esito.get('riassunto') or ''}"
    ).strip()

    prop: dict = {
        "Ultimo movimento": {"date": {"start": oggi}},
        "Prossima azione": {"rich_text": _testo(esito.get("prossima_azione") or "")},
    }
    facoltative: dict = {}
    if esito.get("importo"):
        facoltative["Importo richiesto"] = {"number": float(esito["importo"])}
    if FORME.get(esito.get("forma") or ""):
        facoltative["Forma"] = {"select": {"name": FORME[esito["forma"]]}}
    if TIPI_CLIENTE.get(esito.get("tipo_cliente") or ""):
        facoltative["Tipo cliente"] = {"select": {"name": TIPI_CLIENTE[esito["tipo_cliente"]]}}
    if esito.get("regione") in REGIONI:
        facoltative["Regione"] = {"select": {"name": esito["regione"]}}
    if esito.get("under_35"):
        facoltative["Under 35"] = {"checkbox": True}
    if esito.get("disoccupato"):
        facoltative["Disoccupato"] = {"checkbox": True}

    async with _notion() as n:
        pagina = await _trova_pratica(n, cliente["id"]) if cliente else None
        if pagina:
            attuali = pagina.get("properties", {})
            prop.update({k: v for k, v in facoltative.items() if _vuota(attuali.get(k))})
            r = await n.patch(f"/pages/{pagina['id']}", json={"properties": prop})
            r.raise_for_status()
        else:
            nome = nome_cliente(cliente) or esito.get("nome") or numero or "Sconosciuto"
            prop.update(facoltative)
            prop.update(
                {
                    "Pratica": {"title": _testo(f"{nome} - chiamata AI")},
                    "Stato": {"select": {"name": "Primo contatto"}},
                    "Canale": {"select": {"name": "Diretto"}},
                }
            )
            if cliente:
                prop["ID MIA"] = {"rich_text": _testo(cliente["id"])}
            r = await n.post(
                "/pages",
                json={
                    "parent": {"type": "data_source_id", "data_source_id": os.environ["NOTION_DATA_SOURCE_ID"]},
                    "properties": prop,
                },
            )
            r.raise_for_status()
            pagina = r.json()

        r = await n.patch(
            f"/blocks/{pagina['id']}/children",
            json={
                "children": [
                    {"type": "heading_3", "heading_3": {"rich_text": _testo(f"Chiamata AI {oggi}")}},
                    {"type": "paragraph", "paragraph": {"rich_text": _testo(resoconto)}},
                ]
            },
        )
        r.raise_for_status()

    logger.info(f"Esito salvato in Notion: {pagina.get('url')}")
    return pagina.get("url", "")
