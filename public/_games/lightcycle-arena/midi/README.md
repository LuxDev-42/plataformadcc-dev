# Trilha sonora (MIDI)

Esta pasta guarda a trilha do jogo em **MIDI** (`.mid`). O jogo **não toca o arquivo
direto** — ele lê as notas e sintetiza o som com osciladores (timbre chiptune), no
mesmo motor de áudio dos efeitos. Por isso **não há arquivos de áudio** aqui, só
`.mid` (uns poucos KB cada), e nada de licença de gravação/sample.

## Como adicionar uma música

1. Coloque o arquivo `.mid` **nesta pasta** (`midi/`).
2. Registre o nome no **`manifest.json`** — em `normal` (partida comum) ou
   `danger` (modo ARES):

```json
{
  "normal": ["minha-musica.mid", "outra.mid"],
  "danger": ["tema-do-ares.mid"]
}
```

O nome no manifesto tem que ser **exatamente** o nome do arquivo.
O servidor estático (Nuxt) não lista diretório, então essa lista explícita é o que
o jogo usa pra saber quais faixas existem. Listas vazias = jogo roda sem trilha
(os efeitos sonoros continuam normais).

## Importante (direitos autorais)

Use só **composições livres**: originais suas, de **domínio público** (clássicos)
ou sob licença **CC0**. MIDI evita o direito da *gravação*, mas **não** o da
*composição* — um `.mid` de uma música protegida ainda infringe. Mantenha a trilha
limpa de direitos.

## Detalhes técnicos

- Suporta Standard MIDI File formato 0 e 1, com tempo (BPM) variável.
- O canal 10 (percussão GM) é sintetizado: bumbo, caixa, palma, chimbal (aberto/fechado),
  pratos (crash/ride), toms e rim. Outras notas de percussão viram um ruído curto.
- Polifonia melódica limitada a 24 vozes simultâneas (a percussão é fire-and-forget).
