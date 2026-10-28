# Agente vocale Job Academy

Risponde al telefono (e richiama chi ha compilato il modulo) per qualificare le richieste di microcredito. Parla in italiano e passa alla lingua del cliente quando capisce che fatica con l'italiano. Segue il colloquio da 15 minuti e le regole MIA, poi salva l'esito nella pratica su Notion ("Pratiche microcredito").

Software open source: [Pipecat](https://github.com/pipecat-ai/pipecat) (licenza BSD). Si pagano solo i servizi usati durante le chiamate.

## Come funziona

1. Twilio riceve la chiamata e apre uno stream audio verso questo server.
2. ElevenLabs trascrive la voce e riconosce da solo la lingua.
3. Claude conduce il colloquio. Quando serve, chiama lo strumento `cambia_lingua` e la voce passa alla nuova lingua.
4. ElevenLabs legge la risposta con una voce multilingue.
5. A fine chiamata Claude chiama `salva_esito`: la pratica Notion collegata alla richiesta (campo "ID MIA") viene aggiornata con prossima azione, data e resoconto. Se il numero non ha una richiesta, crea una nuova pratica in "Primo contatto". Se il cliente riattacca prima, salva comunque un riassunto.

Lingue della voce: con il modello veloce (`eleven_flash_v2_5`) inglese, francese, spagnolo, rumeno, arabo, portoghese, ucraino, russo, polacco, cinese, hindi, filippino e altre; per urdu, bengalese e punjabi passa da solo al modello esteso (`eleven_v4_turbo`). Queste ultime vanno provate prima di usarle con i clienti.

## Attivazione

### 1. Account da creare

| Servizio | Cosa fare | Variabile |
| --- | --- | --- |
| Anthropic | console.anthropic.com → Billing (ricarica credito) → API Keys → Create Key | `ANTHROPIC_API_KEY` |
| ElevenLabs | elevenlabs.io, piano a pagamento → Developers → API Keys (permessi Speech to Text e Text to Speech) | `ELEVENLABS_API_KEY` |
| ElevenLabs | Voices → Voice Library: scegli una voce italiana multilingue, copia il Voice ID | `ELEVENLABS_VOICE_ID` |
| Twilio | console.twilio.com → Upgrade (ricarica) → Phone Numbers → Regulatory Compliance: crea il bundle per l'Italia con i dati di Job Academy srl → compra un numero +39 con Voice | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMERO` |
| Notion | notion.so/profile/integrations → New integration (interna) → copia il token. Poi apri il database "Pratiche microcredito" → ⋯ → Connections → aggiungi l'integrazione | `NOTION_TOKEN` |
| Supabase | Project Settings → API Keys → `service_role` (resta solo sul server) | `SUPABASE_SERVICE_ROLE_KEY` |

`RICHIAMA_SEGRETO` è una password lunga inventata da te (ad esempio generata da un password manager).

### 2. Pubblicazione su Railway

1. railway.com → New Project → Deploy from GitHub repo → scegli questo repository. Il `Dockerfile` è già pronto.
2. Settings → Networking → Generate Domain. Copia l'indirizzo (es. `https://agente-vocale.up.railway.app`) in `PUBLIC_URL`.
3. Variables → incolla tutte le variabili di `.env.example` con i valori veri.
4. Controlla che `https://<indirizzo>/salute` risponda `{"ok":true}`.

### 3. Collegare il numero

Twilio → Phone Numbers → il tuo numero → Voice Configuration → *A call comes in*: Webhook `https://<indirizzo>/twilio/voce`, metodo HTTP POST. Salva e chiama il numero per provare.

### 4. Richiami dal modulo

Richiamo manuale di una richiesta:

```
curl -X POST https://<indirizzo>/richiama \
  -H "Authorization: Bearer <RICHIAMA_SEGRETO>" \
  -H "Content-Type: application/json" \
  -d '{"cliente_id": "<id della richiesta in Supabase>"}'
```

Richiamo automatico a ogni nuova richiesta: in Supabase → Database → Webhooks → Create: tabella `clients`, evento Insert, HTTP POST a `https://<indirizzo>/supabase/nuova-richiesta`, header `Authorization: Bearer <RICHIAMA_SEGRETO>`. Poi imposta `RICHIAMO_AUTOMATICO=1`.

Il server chiama solo richieste con il consenso privacy registrato e solo dal lunedì al sabato, dalle 9 alle 20.

## Regole di conformità già nel codice

- La prima frase dichiara sempre che è un'intelligenza artificiale.
- Nessun audio registrato: in Notion finisce solo il resoconto scritto.
- Niente pagamenti, IBAN, documenti o codice fiscale al telefono.
- Chi chiede di non essere richiamato viene segnato con esito `non_richiamare`.
- Le chiamate in uscita partono solo verso chi ha inviato il modulo. Per liste diverse (lead acquistati, contatti freddi) servono il consenso specifico e la verifica sul Registro delle Opposizioni: non usare questo server per quelle chiamate.

## Prova in locale

```
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # e compila i valori
python server.py
```

Per ricevere le chiamate in locale serve un tunnel pubblico (ad esempio `ngrok http 8000`), il cui indirizzo va in `PUBLIC_URL` e nel webhook Twilio.

## File

| File | Contenuto |
| --- | --- |
| `server.py` | Webhook Twilio, stream audio, richiami |
| `bot.py` | La singola chiamata: trascrizione, Claude, voce, strumenti |
| `prompt.py` | Istruzioni dell'agente e saluto iniziale |
| `crm.py` | Lettura delle richieste da Supabase e scrittura dell'esito in Notion |
