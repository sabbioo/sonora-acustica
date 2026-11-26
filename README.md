# SONORA — Laboratorio interattivo di acustica

Versione **0.6** di un ambiente interattivo per lo studio dell’acustica. Il percorso segue quattro moduli e mette in relazione schede teoriche, simulazioni e autoverifica. Le schede teoriche pertinenti aprono direttamente i laboratori collegati; da ogni laboratorio si può tornare alla sezione teorica corrispondente. Ogni laboratorio descrive il risultato atteso e le condizioni del modello.

## Contenuto

- **Panoramica**: percorso delle lezioni, accesso ai laboratori e attività registrata localmente.
- **Confronto di fase**: due sinusoidi a frequenza comune; si modificano fase e ampiezze, si osserva la somma e si legge una spiegazione del risultato atteso per i casi principali (in fase, quadratura, opposizione, sfasamento intermedio).
- **Battimenti**: si impostano due frequenze; il sito mostra inviluppo, frequenza media, frequenza di battimento e periodo, con una spiegazione aggiornata al caso scelto.
- **Posizionamento dei microfoni**: si trascinano due microfoni in una scena 2D vista dall'alto. La selezione della sorgente comprende tre modelli generati nel browser (tono puro, corda vibrante con armoniche, rumore bianco) e sei registrazioni reali del dataset ESC-10: abbaio di cane, pioggia, ticchettio di orologio, crepitio del fuoco, elicottero e motosega. Le registrazioni si caricano da GitHub/CDN quando vengono selezionate, quindi per questi sei esempi è necessaria una connessione Internet.
- **Risultato atteso nel laboratorio microfoni**: la spiegazione cambia in base alla sorgente e alla geometria. Per il tono puro mostra l'ampiezza di picco teorica della somma nei casi di fase; per la sorgente armonica calcola gli sfasamenti delle armoniche; per rumore e registrazioni reali spiega perché non esiste una fase globale e mostra la somma dei campioni ritardati. I file reali sono usati come segnali di partenza: la simulazione applica ritardo geometrico e attenuazione ideale, ma non ricostruisce l'ambiente originale o la direttività della sorgente.
- **Ripasso delle quattro lezioni**: schede teoriche consultabili per modulo, con definizioni, formule, esempi e note sulle confusioni più comuni. Le schede su fase, sovrapposizione, battimenti e microfoni includono un collegamento diretto al laboratorio pertinente.
- **Autoverifica**: banca di domande suddivisa per lezione. Si può avviare un test completo oppure concentrarsi su un singolo modulo. Ogni risposta riceve una spiegazione.
- **Formulario**: relazioni principali delle quattro lezioni e dei laboratori.

## Avvio locale su Linux

Non servono Node, npm, framework o installazioni aggiuntive.

```bash
cd sonora-acustica
./start-local.sh
```

Apri quindi `http://localhost:8000`.

In alternativa:

```bash
python3 -m http.server 8000
```

Aprire `http://localhost:8000`. Un server locale è preferibile all'apertura diretta di `index.html` per verificare il comportamento del browser.

## Modello del laboratorio microfoni

La scena rappresenta dall'alto un'area di 8 × 5 metri. La sorgente è puntiforme, fissa e omnidirezionale; MIC 1 e MIC 2 sono microfoni ideali e trascinabili. Il menu seleziona segnali di riferimento (sinusoide, modello armonico, rumore) oppure registrazioni reali (abbaio, pioggia, orologio, crepitio del fuoco, elicottero, motosega) caricate dal repository GitHub ESC-50. Si possono modificare le coordinate x/y, la frequenza (o fondamentale/frequenza di riferimento), la velocità del suono e la pressione di riferimento a un metro.

Il modello assume:

- propagazione in campo libero;
- velocità del suono costante;
- nessuna riflessione o diffrazione;
- microfoni omnidirezionali ideali;
- pressione proporzionale a `1/r`.

Per ciascun microfono vengono calcolati distanza e tempo di propagazione. La differenza tra le distanze determina il ritardo relativo:

- `Δr = r₂ − r₁`
- `Δt = Δr / c`
- `Δφ = −2π f Δt` (fase di MIC 2 rispetto a MIC 1, riferita alla frequenza impostata).

Nel caso armonico la fase mostrata si riferisce alla fondamentale: la seconda armonica accumula il doppio dello sfasamento, la terza il triplo e così via. Nel caso del rumore, la fase è soltanto un riferimento alla frequenza impostata, perché le componenti sono numerose e non esiste un'unica fase globale.

Il valore efficace della somma viene stimato numericamente. Per il tono puro, il riquadro di spiegazione mostra anche l'ampiezza di picco teorica attesa dalla differenza di fase e dai livelli ricevuti. Per il suono armonico mostra come lo sfasamento si moltiplica per l'ordine dell'armonica, con un esempio esplicito (180° sulla fondamentale: 360° sulla seconda e 540° sulla terza); per il rumore confronta anche lo sfasamento di due frequenze campione e specifica che non esiste una fase globale. I tre pulsanti audio permettono di ascoltare MIC 1, MIC 2 oppure la somma. I segnali ideali sono generati nel browser. Le registrazioni reali sono caricate su richiesta dal repository pubblico ESC-50 tramite CDN; per usarle serve una connessione Internet. Non si accede al microfono reale del dispositivo.

I preset geometrici impostano percorsi uguali oppure una differenza di percorso pari a `λ/4` o `λ/2`, compatibilmente con l'area di lavoro.

## Materiali didattici inclusi nel ripasso

Le schede seguono i contenuti dei materiali di studio allegati:

1. **Lezione 01 — Che cos'è il suono?**: sorgente, propagazione, ricezione, onde meccaniche, compressioni e rarefazioni, grafico temporale, frequenza, ampiezza, timbro e microfono come trasduttore.
2. **Lezione 02 — Le caratteristiche di un'onda sonora**: ciclo, periodo, frequenza, descrizione nel tempo e nello spazio, lunghezza d'onda, velocità, diffrazione, fase, sovrapposizione, onde complesse, armoniche, parziali e monocordo.
3. **Lezione 03 — La fase e l'interazione tra le onde**: cerchio di fase, gradi e radianti, funzione sinusoidale, pulsazione, fase iniziale e istantanea, ritardo, differenza di percorso, sovrapposizione e interferenza.
4. **Lezione 04 — Interferenza e battimenti**: frequenze uguali e differenti, formula di prostaferesi, frequenza media, inviluppo, frequenza e periodo dei battimenti, accordatura e collegamento ai microfoni e all'effetto pettine.

## Scelte tecniche

- HTML, CSS e JavaScript puro.
- Canvas 2D per grafici, fronti d'onda schematici e posizionamento trascinabile dei microfoni.
- Web Audio API per generare i segnali soltanto su richiesta dell'utente.
- `localStorage` per mantenere i progressi sul dispositivo corrente.
- Nessun account, server applicativo, upload audio o accesso al microfono reale.

## Pubblicazione su GitHub Pages

La pubblicazione è rimandata finché la versione locale non sarà stata verificata e approvata. Prima di pubblicare, ricordare che GitHub Pages non offre un accesso riservato tramite il solo link: il sito pubblicato può essere pubblico. Non inserire dati personali, credenziali o informazioni riservate nei contenuti pubblici.

## Versione 0.5

- Rafforzata la spiegazione del risultato atteso per le sorgenti armoniche e di rumore con esempi numerici riferiti a frequenze specifiche.
- Dal laboratorio microfoni è possibile tornare direttamente alle lezioni 02 e 03, che forniscono rispettivamente il modello di propagazione e quello di fase.

## Versione 0.4

- Aggiunte spiegazioni numeriche del risultato atteso nel laboratorio microfoni.
- Reso più chiaro il menu delle sorgenti: generatore sinusoidale, corda vibrante e sorgente di rumore.
- Organizzato il catalogo dei modelli di sorgente in modo da poter aggiungere ulteriori casi.
- Collegate le schede teoriche ai laboratori pertinenti: dalla spiegazione si può aprire direttamente la simulazione.
- Aggiornata l'etichetta temporale del grafico anche per il caso di rumore.

## Struttura

```text
sonora-acustica/
├── index.html
├── styles.css
├── app.js
├── README.md
├── CHANGELOG.md
├── .nojekyll
├── start-local.sh
└── assets/
    └── sonora-mark.svg
```


## Registrazioni reali e attribuzioni (v0.6)

I campioni selezionati provengono dal sottoinsieme ESC-10 del dataset ESC-50 di Karol J. Piczak. Il README e il file `LICENSE` del repository indicano che il sottoinsieme ESC-10 è distribuito con licenza Creative Commons Attribution 3.0 Unported (CC BY 3.0). Le singole registrazioni qui usate sono attribuite nei metadati del repository ai rispettivi autori Freesound e riportate come CC0:

| Campione | File ESC-50 | Registrazione originale | Autore / fonte |
|---|---|---|---|
| Abbaio di cane | `1-100032-A-0.wav` | rose_bark.wav | nfrae · Freesound 100032 · CC0 |
| Pioggia | `1-17367-A-10.wav` | unlocki door to mod rain.wav | cognito perceptu · Freesound 17367 · CC0 |
| Orologio | `1-35687-A-38.wav` | Clock-grandfather-ticks & striking once | Bansemer · Freesound 35687 · CC0 |
| Fuoco | `1-17808-A-12.wav` | Foc.WAV | Everard · Freesound 17808 · CC0 |
| Elicottero | `1-172649-A-40.wav` | Small Helicopter Takes Off | senorstudy · Freesound 172649 · CC0 |
| Motosega | `1-116765-A-41.wav` | chainsaw.wav | UncleSigmund · Freesound 116765 · CC0 |

Attribuzione del dataset: Karol J. Piczak, *ESC: Dataset for Environmental Sound Classification*, ACM Multimedia 2015, DOI: 10.1145/2733373.2806390. Repository e licenze: https://github.com/karolpiczak/ESC-50. I file audio sono serviti da jsDelivr a partire dal repository pubblico; non sono copiati nel pacchetto.

Le registrazioni non sono toni puri: il controllo della frequenza nel laboratorio è un riferimento per calcolare una lunghezza d'onda o una fase a quella frequenza, non cambia il contenuto del file. Il grafico e l'audio riproducono invece la registrazione acquisita, con ritardo e attenuazione applicati ai due percorsi ideali. La simulazione tratta il file registrato come segnale emesso al tempo zero: non stima la direttività della sorgente né rimuove le caratteristiche dell'ambiente in cui il campione è stato registrato.

## Versione 0.6

- Aggiunte sei registrazioni ambientali reali al catalogo del laboratorio microfoni, con attribuzioni e licenze riportate.
- Aggiunta l'anteprima della sorgente originale, oltre all'ascolto dei due microfoni e della somma.
- Aggiunta una spiegazione specifica per le registrazioni complesse: non si assegna una fase unica all'intero campione.
- Ampliate le schede di teoria con spiegazioni estese ed esempi.
- Corretto il formulario: le formule lunghe si adattano alla larghezza della scheda e la relazione di prostaferesi è disposta su due righe.


## Pubblicazione

Il progetto è statico e può essere pubblicato con GitHub Pages. Per mantenere il repository ordinato, usare il nome `sonora-acustica` e caricare il contenuto di questa cartella nella radice del repository. In GitHub: **Settings → Pages → Deploy from a branch → main → /(root)**.

Prima di pubblicare, scegliere e aggiungere una licenza per il codice e per i contenuti originali. I campioni audio mantengono le licenze e le attribuzioni indicate nella sezione precedente.

## Licenze

SONORA contiene codice e materiali didattici con licenze distinte.
Consulta [LICENSES.md](LICENSES.md) e
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
per i rispettivi ambiti e le attribuzioni.
