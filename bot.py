"""Una telefonata: Twilio ↔ trascrizione ElevenLabs ↔ Claude ↔ voce ElevenLabs."""

import asyncio
import os

from anthropic import AsyncAnthropic
from loguru import logger
from pipecat.adapters.llm.schemas.direct_function import tool_options
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import EndWorkerFrame, TTSSpeakFrame, TTSUpdateSettingsFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.anthropic.llm import AnthropicLLMService
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.elevenlabs.tts_base import ELEVENLABS_MODEL_LANGUAGES
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transports.base_transport import BaseTransport
from pipecat.workers.runner import WorkerRunner

import crm
from prompt import ISTRUZIONI, saluto

MODELLO_VOCE = os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5")
# Per le lingue che il modello veloce non copre (urdu, bengalese, punjabi...)
MODELLO_VOCE_ESTESO = os.getenv("ELEVENLABS_MODEL_ESTESO", "eleven_v4_turbo")
DURATA_MASSIMA_SECONDI = int(os.getenv("DURATA_MASSIMA_SECONDI", "1200"))

ESITI = {"interessato", "da_richiamare", "non_idoneo", "non_interessato", "non_richiamare", "vuole_operatore"}


async def run_bot(transport: BaseTransport, chiamata: dict):
    """Gestisce la chiamata fino alla fine.

    Args:
        transport: trasporto websocket già collegato allo stream Twilio.
        chiamata: numero, direzione ("entrata"/"uscita") e cliente Supabase, se noto.
    """
    cliente = chiamata.get("cliente")
    stato = {"lingua": "it", "salvato": False}

    stt = ElevenLabsRealtimeSTTService(
        api_key=os.environ["ELEVENLABS_API_KEY"],
        include_language_detection=True,
        # language=None: riconosce da solo la lingua di ogni frase
        settings=ElevenLabsRealtimeSTTService.Settings(language=None),
    )
    tts = ElevenLabsTTSService(
        api_key=os.environ["ELEVENLABS_API_KEY"],
        settings=ElevenLabsTTSService.Settings(
            voice=os.environ["ELEVENLABS_VOICE_ID"], model=MODELLO_VOCE, language="it"
        ),
    )
    llm = AnthropicLLMService(
        api_key=os.environ["ANTHROPIC_API_KEY"],
        settings=AnthropicLLMService.Settings(
            model=os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5"),
            system_instruction=ISTRUZIONI,
            max_tokens=1024,
            effort="low",
            enable_prompt_caching=True,
        ),
    )

    async def cambia_lingua(params: FunctionCallParams, lingua: str):
        """Cambia la lingua della voce prima di continuare in un'altra lingua.

        Args:
            lingua: codice ISO 639-1 della lingua, ad esempio "en", "fr", "es", "ro", "ar", "ur", "it".
        """
        lingua = lingua.strip().lower()[:3]
        if lingua in ELEVENLABS_MODEL_LANGUAGES.get(MODELLO_VOCE, ()):
            modello = MODELLO_VOCE
        elif lingua in ELEVENLABS_MODEL_LANGUAGES.get(MODELLO_VOCE_ESTESO, ()):
            modello = MODELLO_VOCE_ESTESO
        else:
            await params.result_callback(
                {"ok": False, "motivo": f"lingua {lingua} non disponibile per la voce: proponi inglese o francese"}
            )
            return
        # Spinto subito verso la voce, così la risposta successiva esce già nella nuova lingua
        await params.llm.push_frame(
            TTSUpdateSettingsFrame(delta=ElevenLabsTTSService.Settings(model=modello, language=lingua))
        )
        stato["lingua"] = lingua
        logger.info(f"Lingua cambiata in {lingua} ({modello})")
        await params.result_callback({"ok": True, "lingua": lingua})

    async def salva_esito(
        params: FunctionCallParams,
        esito: str,
        riassunto: str,
        prossima_azione: str,
        nome: str | None = None,
        attivita: str | None = None,
        importo: int | None = None,
        forma: str | None = None,
        citta: str | None = None,
        regione: str | None = None,
        segnalazioni_crif: str | None = None,
        tipo_cliente: str | None = None,
        under_35: bool | None = None,
        disoccupato: bool | None = None,
    ):
        """Salva l'esito della chiamata nella pratica. Va chiamato una volta, prima dei saluti.

        Args:
            esito: uno tra interessato, da_richiamare, non_idoneo, non_interessato, non_richiamare, vuole_operatore.
            riassunto: tre o quattro frasi in italiano su progetto, dubbi e accordi presi, compreso l'orario preferito per essere ricontattati.
            prossima_azione: cosa deve fare Job Academy, in italiano, ad esempio "Inviare link modulo" o "Richiamare giovedì mattina".
            nome: nome e cognome detti dalla persona, se non già noti.
            attivita: l'attività che vuole avviare o far crescere.
            importo: importo richiesto in euro.
            forma: persona_fisica, ditta_individuale, srl o altra_societa.
            citta: città dell'attività.
            regione: una tra Liguria, Lombardia, Piemonte, Toscana, Altra Centro-Nord, Sud, Estero AIRE.
            segnalazioni_crif: si, no o non_so.
            tipo_cliente: ha_idea, senza_idea, rendita_gestita o azienda_esistente.
            under_35: true se ha meno di 35 anni.
            disoccupato: true se oggi non lavora.
        """
        if esito not in ESITI:
            await params.result_callback({"ok": False, "motivo": f"esito deve essere uno tra {sorted(ESITI)}"})
            return
        dati = {k: v for k, v in params.arguments.items()}
        dati["lingua"] = stato["lingua"]
        try:
            await crm.salva_esito_notion(
                cliente=cliente, numero=chiamata.get("numero"), direzione=chiamata["direzione"], esito=dati
            )
            stato["salvato"] = True
            await params.result_callback({"ok": True})
        except Exception as e:
            logger.exception(f"Salvataggio in Notion non riuscito: {e}")
            stato["salvato"] = True  # evita un secondo tentativo a fine chiamata con dati peggiori
            await params.result_callback({"ok": False, "motivo": "salvataggio non riuscito, saluta comunque"})

    @tool_options(cancel_on_interruption=False)
    async def termina_chiamata(params: FunctionCallParams):
        """Chiude la telefonata dopo il saluto finale."""
        await params.result_callback({"ok": True})
        await params.llm.push_frame(EndWorkerFrame())

    context = LLMContext(tools=[cambia_lingua, salva_esito, termina_chiamata])
    if cliente:
        context.add_message(
            {
                "role": "developer",
                "content": (
                    "Dati della richiesta inviata dal modulo (usali, non richiederli): "
                    f"nome {crm.nome_cliente(cliente)}, tipo {cliente.get('tipo')}, "
                    f"importo richiesto {cliente.get('importo_richiesto') or 'non indicato'} euro, "
                    f"attività {cliente.get('attivita') or 'non indicata'}."
                ),
            }
        )

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context, user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer())
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(audio_in_sample_rate=8000, audio_out_sample_rate=8000, enable_usage_metrics=True),
        idle_timeout_secs=90,
    )
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    async def limite_durata():
        await asyncio.sleep(DURATA_MASSIMA_SECONDI)
        logger.warning("Durata massima raggiunta, chiudo la chiamata")
        await worker.queue_frames(
            [TTSSpeakFrame("Mi scuso, devo chiudere la chiamata. Un consulente la ricontatterà."), EndWorkerFrame()]
        )

    timer = None

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        nonlocal timer
        nome = (cliente.get("nome") or crm.nome_cliente(cliente)) if cliente else None
        await worker.queue_frames([TTSSpeakFrame(saluto(nome, chiamata["direzione"] == "uscita"))])
        timer = asyncio.create_task(limite_durata())

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        await runner.cancel()

    try:
        await runner.run()
    finally:
        if timer:
            timer.cancel()
        if not stato["salvato"]:
            await salva_chiamata_interrotta(context, cliente, chiamata, stato["lingua"])


async def salva_chiamata_interrotta(context: LLMContext, cliente: dict | None, chiamata: dict, lingua: str):
    """Se la persona riattacca prima della fine, salva comunque un riassunto della conversazione."""
    righe = []
    for m in context.get_messages():
        if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str) and m["content"].strip():
            righe.append(f"{'Cliente' if m['role'] == 'user' else 'Agente'}: {m['content']}")
    if not any(r.startswith("Cliente:") for r in righe):
        logger.info("Chiamata chiusa senza conversazione: niente da salvare")
        return
    try:
        client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        risposta = await client.messages.create(
            model=os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5"),
            max_tokens=1024,
            output_config={"effort": "low"},
            messages=[
                {
                    "role": "user",
                    "content": "Riassumi in italiano, in quattro frasi al massimo, questa telefonata di "
                    "qualifica per il microcredito interrotta prima della fine: progetto, importo, "
                    "dubbi e a che punto si è arrivati.\n\n" + "\n".join(righe),
                }
            ],
        )
        riassunto = "".join(b.text for b in risposta.content if b.type == "text")
        await crm.salva_esito_notion(
            cliente=cliente,
            numero=chiamata.get("numero"),
            direzione=chiamata["direzione"],
            esito={
                "esito": "interrotta",
                "riassunto": riassunto,
                "prossima_azione": "Richiamare: chiamata AI interrotta",
                "lingua": lingua,
            },
        )
    except Exception as e:
        logger.exception(f"Salvataggio della chiamata interrotta non riuscito: {e}")
