# Lightcycle Arena

Corrida de **motos de luz** estilo Tron. Cada moto deixa um rastro sólido por onde
passa. Você perde se bater em uma parede, no rastro do adversário ou no seu próprio
rastro — então o objetivo é **encurralar o oponente** até que ele não tenha mais
para onde ir, sem se fechar antes.

## Objetivo pedagógico

O jogo trabalha, de forma lúdica e em ritmo acelerado:

- **Raciocínio espacial** — ler o espaço livre da arena e enxergar para onde dá (e
  não dá) para ir.
- **Planejamento e antecipação** — pensar alguns passos à frente: cada curva fecha
  espaço para os dois lados, então a criança aprende a prever consequências.
- **Tomada de decisão sob pressão** — escolhas rápidas com tempo limitado, treinando
  reflexo e atenção.
- **Gestão de risco** — equilibrar agressividade (fechar o oponente) com segurança
  (não se prender no próprio rastro). Virar custa velocidade, o que ensina a dosar
  os movimentos.

Modos de 1 jogador (contra o computador, com dificuldade ajustável) e 2 jogadores
no mesmo teclado também estimulam **cooperação/competição** e a leitura da jogada
do outro.

## Controles

### No jogo
| Ação | Jogador 1 | Jogador 2 |
|------|-----------|-----------|
| Cima / Baixo / Esquerda / Direita | `W` `A` `S` `D` | `↑` `←` `↓` `→` |

> No modo de **1 jogador**, as setas também controlam o Jogador 1.

- `P` — pausar / retomar
- `M` — ligar/desligar o som
- `Esc` — voltar ao menu

### Nos menus
- `W` `A` `S` `D` ou setas — navegar
- `Enter` / `Espaço` — selecionar
- `Esc` — voltar

Também dá para jogar tudo com o **mouse** (clicar nos botões).

## Como jogar

1. Escolha **1 Jogador** (contra a CPU) ou **2 Jogadores**.
2. Em **Opções** dá para ajustar nº de adversários (Programas), dificuldade, cores e áudio.
3. Vence a partida quem fizer **5 pontos** primeiro (melhor de 10).

## Notas técnicas

- **100% offline / self-contained**: não usa backend, CDN, cookies ou trackers. As
  fontes (Orbitron/Rajdhani) são auto-hospedadas e **todo o áudio é sintetizado** via
  Web Audio API — os efeitos (motores, explosões, jingles, menu) são procedurais e a
  trilha vem de arquivos **MIDI** tocados por osciladores (sem arquivos de áudio).
- A trilha MIDI fica em `midi/` (veja o `README.md` de lá pra adicionar faixas).
- Roda em `<iframe sandbox>` (apenas `allow-scripts` + `allow-same-origin`). O áudio
  é destravado no primeiro clique/tecla (sem depender de autoplay).
- Pensado para **teclado** → `compatibility: ['pc']`.

## Estrutura

```
lightcycle-arena/
├── index.html      ← entrypoint (o jogo)
├── src/            ← módulos ES (lógica, IA, gráficos, áudio, MIDI, config)
├── fonts/          ← Orbitron + Rajdhani (.woff2) e a fonte do título
└── midi/           ← trilha sonora em .mid + manifest.json
```
