# Como os bots funcionam

Código em [`src/ai/`](../src/ai). Cada bot tem uma **personalidade** (um conjunto de números, em
[`src/config.ts`](../src/config.ts)) e decide a próxima rua toda vez que chega a um cruzamento.

## As quatro personalidades

Com `CFG.botBrain = 'smart'` (padrão), cada cor é um jeito de jogar:

| Cor      | Personalidade | Como joga                                                                                         |
| -------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Vermelho | **caçador**   | Vai atrás de bandeiras inimigas e de quem lidera, persegue de leve e defende as próprias bandeiras de quem se aproxima. |
| Roxo     | **cauteloso** | Laços bem longe dos inimigos (peso de risco 2,8) e desvia de quase todo tiro.                      |
| Laranja  | **guloso**    | Laços maiores (1,35×) e preferência por roubar: tenta conquistar muito de uma vez.                |
| (teste)  | **clássico**  | O comportamento original: sem reação, todos iguais. Existe como adversário de referência.         |

Os três "inteligentes" compartilham uma base (`SMART`, em `config.ts`) **achada por busca evolutiva** (veja abaixo) e
diferem só por variações moderadas dela, então têm força parecida e estilos diferentes. Com `CFG.botBrain = 'classic'`,
os três bots viram clássicos.

Os campos de uma personalidade (`Personality`) são: `loopMul`, `planTries`, `riskWeight`, `stealBonus`, `leaderBias`,
`huntFlagP`, `chaseP`, `chaseSteps`, `dodge` e `defend`, todos explicados em `config.ts`.

## Três camadas de decisão

[`ai/bot.ts`](../src/ai/bot.ts), em `botPick`, a cada cruzamento:

1. **Reação (`defend`)**: um inimigo está vindo na direção de uma bandeira minha, perto (≤ 120 px)? Largo a rota e vou
   interceptá-lo por 2 passos. Só vale com 2+ bandeiras fincadas, e quem só passa por perto não conta.
2. **Deliberação (`botThink`)**: sem rota, decide: seguir o plano; caçar a bandeira inimiga mais próxima; perseguir um
   inimigo; ou planejar uma conquista nova. O líder do placar é um alvo preferido (`leaderBias`).
3. **Desvio (`dodge`)**: a rua escolhida segue por dentro da linha de fogo de alguém? Troca por uma lateral que deixe
   perto do destino. Atravessar a linha de lado não conta; o perigo é andar ao longo dela.

Estado de cada bot: `plan` (bandeiras a fincar, terminando na primeira pra fechar o laço) e `route` (nós até o destino
imediato, por caminho mínimo). Ao chegar ao próximo ponto do plano, finca a bandeira com a mesma `plant()` do jogador.
Sem rota nenhuma, vira numa rua qualquer.

### Percepção ([`ai/perception.ts`](../src/ai/perception.ts))

Só leitura do estado:

- `incomingFire`: o tiro que cada inimigo com a recarga acabando soltaria agora **e** o trajeto restante dos tiros em
  voo. Reaproveita `traceShot`/`tracePath`, o mesmo cálculo da sua prévia pontilhada.
- `edgeExposed`: andar por uma rua seguiria por dentro de alguma dessas linhas?
- `chainThreat`: algum inimigo está indo destruir uma bandeira minha?

## Planejando uma conquista ([`ai/planner.ts`](../src/ai/planner.ts))

Amostragem aleatória com pontuação:

1. `planTries` tentativas. Cada uma sorteia um centro perto do bot e 3 a 5 pontos num círculo de raio 70–190, e usa o
   cruzamento mais próximo de cada um.
2. Descarta laços com perímetro maior que `botMaxLoop × loopMul`.
3. **Ganho** = área dos quarteirões que ainda não são dele. Quarteirão de outro vale `stealBonus`× (e mais ainda se o
   dono for o líder, via `leaderBias`).
4. **Pontuação** = `ganho / (perímetro + distância·0,6 + 200 + riskWeight·risco)`. O **risco** soma, por par
   (inimigo, bandeira do laço), quão perto o inimigo está (até 300 px). Chegar a uma bandeira destrói a cadeia inteira,
   então laços com adversários por perto valem menos.
5. Gira a lista pra começar pela bandeira mais próxima e repete a primeira no fim.

## Combate ([`ai/combat.ts`](../src/ai/combat.ts))

No modo `street`, o bot simula o próprio tiro e só atira se o caminho passaria por um inimigo vivo e sem invulnerabilidade.
Ele **não mira nem se vira**: dispara pra onde está olhando, se calhar de acertar. Recarga: `botShotCd` (1,0 s), contra
`shotCd` (0,45 s) do jogador. Todos atiram em todos.

## Busca evolutiva (`npm run evolve`)

Os parâmetros da base `SMART` não foram escolhidos à mão: vieram de uma Estratégia Evolutiva em
[`sim/evolve.sim.ts`](../sim/evolve.sim.ts). Em cada geração, sorteia 12 variações dos parâmetros atuais, joga 16 partidas
de 4 com cada uma (contra o clássico e as personalidades de referência, em todos os cantos) e fica com a média das
melhores. Todos os candidatos de uma geração jogam nas mesmas sementes, e as sementes mudam a cada geração.

Duas buscas independentes, uma partindo do guloso e outra do **clássico puro**, chegaram a regiões parecidas:

| Parâmetro    | Busca A | Busca B | O que concluímos                                                    |
| ------------ | ------- | ------- | ------------------------------------------------------------------- |
| `planTries`  | 53      | 48      | Planejar com muito mais tentativas compensa (o teto permitido era 60). |
| `riskWeight` | 1,9     | 2,3     | **Dar bastante peso ao risco** (inimigos perto das bandeiras) ajuda muito. |
| `stealBonus` | 1,6     | 1,4     | Preferir roubar quarteirões de outros.                              |
| `huntFlagP`  | 0,11    | 0,10    | Caçar bandeiras rende pouco (já tinha aparecido nas medições à mão). |
| `chaseP`     | 0,12    | 0,09    | Perseguir também.                                                   |
| `loopMul`    | 1,14    | 1,31    | Laços moderadamente grandes.                                        |
| `dodge`      | 0,79    | 0,37    | **Não convergiu**: o território pouco depende disso.                |
| `defend`     | 0,49    | 0,12    | **Não convergiu**, idem.                                            |

`SMART` é a média das duas. Em partidas inéditas, essa média ganhou **83% contra o clássico** e **60% contra o melhor bot
da versão anterior**, que eu tinha ajustado à mão em várias rodadas. As variações de cada personalidade foram escolhidas
para não se afastar demais dessa região (afastar demais custava força).

## O que foi medido à mão (e o que não funcionou)

Antes da evolução, cada ideia foi testada isoladamente contra o clássico com `npm run sim` (ver
[ARCHITECTURE.md](ARCHITECTURE.md)). Vitórias numa dupla contra outra; 50% = empate:

| Ideia                                    | Vitórias | Leitura                                                              |
| ---------------------------------------- | -------- | -------------------------------------------------------------------- |
| Planejar com 40 tentativas (em vez de 14) | ~61–65%  | **A maior alavanca.** 80 tentativas não melhoram.                    |
| Desvio de tiro                           | ~51%     | Mortes caem cerca de um terço, sem perder território.                |
| Foco no líder                            | ~54%     | Pequeno ganho.                                                       |
| Risco no planejamento (peso 1)           | ~49%     | Neutro sozinho; só rendeu muito depois, em combinação (ver acima).   |
| Roubar mais (×1,8)                       | ~47%     | Pior sozinho: tomar terra livre também vale.                         |
| Perseguição longa (30%, 4 passos)        | ~32%     | **Pior.** Matar não rende território; só gasta tempo e arrisca morrer. |
| Defesa larga (220 px, 3 passos)          | ~22–32%  | **Pior.** Larga o plano e entra na linha de fogo.                    |
| Defesa enxuta (120 px, 2 passos, 30%)    | +~5 pts  | Pequeno ganho no caçador, confirmado em duas amostras independentes. |

Note como o risco no planejamento era "neutro" sozinho e acabou sendo um dos parâmetros mais valorizados pela evolução:
os efeitos se combinam, e ajustar um de cada vez à mão não enxerga isso. É o argumento a favor da busca automática.

## Placar da versão atual

Em partidas que nunca foram usadas pra ajustar nada (100 sementes x 2 disposições, 200 partidas por linha):

| Personalidade | vs clássico (base 50%) | vs melhor bot antigo (base 50%) | Em 4 disputando (base 25%) |
| ------------- | ---------------------- | ------------------------------- | -------------------------- |
| guloso        | 79%                    | 59%                             | 32%                        |
| cauteloso     | 82%                    | 63%                             | 30%                        |
| caçador       | 71%                    | 55%                             | 30%                        |
| clássico      | (referência)           | —                               | 8%                         |

Na versão anterior (ajustada à mão), as mesmas medições davam 68%, 51% e 55% contra o clássico, e o clássico ficava com
18% na disputa de quatro. Os bots atuais também morrem de 29% a 43% menos que o clássico. Com 200 partidas o erro é de
uns ±3 pontos: diferenças menores que isso podem ser sorte.

Custo de processamento: 0,02 ms por frame em média e 0,7 ms no pior 0,1% (um pico isolado de ~9 ms em 20 mil frames, quando
os caminhos mínimos são calculados pela primeira vez), bem abaixo dos 16 ms de um frame.

## Limitações conhecidas

- **Ainda são oniscientes**: leem posição e bandeiras de todo mundo, sem "enxergar".
- **Não mira**: só atira quando calha de estar alinhado pela rua.
- **Planejam por sorteio** (50 tentativas por vez), não por busca sistemática.
- **`dodge` e `defend` ficaram sem ajuste fino**: a evolução não os distinguiu, porque o território quase não depende deles.
- O desvio só age nos cruzamentos e só no modo de tiro `street`.
- As três personalidades são parecidas em força. As diferenças são de estilo (onde e como jogam), não de nível.
