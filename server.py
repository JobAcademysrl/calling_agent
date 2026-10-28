"""Server web: risponde alle chiamate Twilio, avvia i richiami e collega lo stream audio all'agente."""

import hmac
import os
import secrets
import time
from datetime import datetime
from xml.sax.saxutils import escape, quoteattr
from zoneinfo import ZoneInfo

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.responses import Response
from loguru import logger

load_dotenv(override=True)

from pipecat.runner.types import WebSocketRunnerArguments  # noqa: E402
from pipecat.runner.utils import create_transport  # noqa: E402
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams  # noqa: E402
from twilio.request_validator import RequestValidator  # noqa: E402
from twilio.rest import Client as TwilioClient  # noqa: E402

import crm  # noqa: E402
from bot import run_bot  # noqa: E402

PUBLIC_URL = os.getenv("PUBLIC_URL", "").rstrip("/")
ROMA = ZoneInfo("Europe/Rome")

app = FastAPI()

# Gettoni monouso: lo stream audio è accettato solo se nasce da un webhook Twilio verificato
_gettoni: dict[str, tuple[float, dict]] = {}


def _nuovo_gettone(dati: dict) -> str:
    adesso = time.time()
    for g, (scadenza, _) in list(_gettoni.items()):
        if scadenza < adesso:
            _gettoni.pop(g, None)
    gettone = secrets.token_urlsafe(24)
    _gettoni[gettone] = (adesso + 60, dati)
    return gettone


def _controlla_segreto(request: Request):
    atteso = os.environ.get("RICHIAMA_SEGRETO", "")
    ricevuto = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not atteso or not hmac.compare_digest(atteso, ricevuto):
        raise HTTPException(401, "Non autorizzato")


def _in_fascia_oraria() -> bool:
    """Richiami solo dal lunedì al sabato, 9-20 (ora italiana)."""
    adesso = datetime.now(ROMA)
    return adesso.weekday() < 6 and 9 <= adesso.hour < 20


@app.get("/salute")
async def salute():
    return {"ok": True}


@app.post("/twilio/voce")
async def twilio_voce(request: Request):
    """Webhook del numero Twilio: chiamate in entrata e richiami avviati da /richiama."""
    form = dict(await request.form())
    url = PUBLIC_URL + request.url.path + (f"?{request.url.query}" if request.url.query else "")
    firma = request.headers.get("X-Twilio-Signature", "")
    if not RequestValidator(os.environ["TWILIO_AUTH_TOKEN"]).validate(url, form, firma):
        logger.warning("Firma Twilio non valida")
        raise HTTPException(403, "Firma non valida")

    cliente_id = request.query_params.get("cliente")
    uscita = bool(cliente_id)
    numero = form.get("To") if uscita else form.get("From")
    gettone = _nuovo_gettone({"cliente_id": cliente_id, "numero": numero, "direzione": "uscita" if uscita else "entrata"})
    ws = PUBLIC_URL.replace("https://", "wss://") + f"/ws/{gettone}"
    twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url={quoteattr(ws)} /></Connect></Response>'
    logger.info(f"Chiamata {'in uscita verso' if uscita else 'in entrata da'} {escape(numero or '?')}")
    return Response(content=twiml, media_type="application/xml")


@app.websocket("/ws/{gettone}")
async def stream_audio(websocket: WebSocket, gettone: str):
    voce = _gettoni.pop(gettone, None)
    if not voce or voce[0] < time.time():
        await websocket.close(code=4003)
        return
    dati = voce[1]
    await websocket.accept()

    cliente = None
    try:
        if dati["cliente_id"]:
            cliente = await crm.carica_cliente(dati["cliente_id"])
        else:
            cliente = await crm.trova_cliente(dati["numero"])
    except Exception as e:
        logger.exception(f"Ricerca del cliente su Supabase non riuscita: {e}")

    runner_args = WebSocketRunnerArguments(websocket=websocket)
    transport = await create_transport(
        runner_args,
        {"twilio": lambda: FastAPIWebsocketParams(audio_in_enabled=True, audio_out_enabled=True)},
    )
    await run_bot(transport, {**dati, "cliente": cliente})


async def _richiama(cliente_id: str) -> dict:
    cliente = await crm.carica_cliente(cliente_id)
    if not cliente:
        raise HTTPException(404, "Richiesta non trovata")
    if not cliente.get("consenso_privacy_at"):
        raise HTTPException(409, "Manca il consenso: non chiamo")
    if not _in_fascia_oraria():
        raise HTTPException(409, "Fuori fascia oraria (lun-sab 9-20): riprova più tardi")
    twilio = TwilioClient(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"])
    call = twilio.calls.create(
        to=crm.numero_e164(cliente["telefono"]),
        from_=os.environ["TWILIO_NUMERO"],
        url=f"{PUBLIC_URL}/twilio/voce?cliente={cliente_id}",
        method="POST",
        time_limit=1500,
    )
    logger.info(f"Richiamo avviato per la richiesta {cliente_id}: {call.sid}")
    return {"ok": True, "call_sid": call.sid}


@app.post("/richiama")
async def richiama(request: Request):
    """Avvia un richiamo: POST {"cliente_id": "..."} con Authorization: Bearer RICHIAMA_SEGRETO."""
    _controlla_segreto(request)
    corpo = await request.json()
    return await _richiama(str(corpo.get("cliente_id", "")))


@app.post("/supabase/nuova-richiesta")
async def nuova_richiesta(request: Request):
    """Webhook del database Supabase sull'inserimento in public.clients."""
    _controlla_segreto(request)
    if os.getenv("RICHIAMO_AUTOMATICO") != "1":
        return {"ok": True, "richiamo": "disattivato"}
    corpo = await request.json()
    cliente_id = (corpo.get("record") or {}).get("id")
    if not cliente_id:
        raise HTTPException(400, "Manca record.id")
    try:
        return await _richiama(cliente_id)
    except HTTPException as e:
        # Fuori orario o senza consenso: lo segnala ma non fa ritentare Supabase
        return {"ok": False, "motivo": e.detail}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
