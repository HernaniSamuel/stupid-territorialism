# stupid territorialism

Você é um triângulo azul num mapa de ruas. Finque bandeiras nos cruzamentos, volte à primeira e **cerque quarteirões** pra
dominá-los, enquanto três bots (vermelho, roxo e laranja) fazem o mesmo, roubam seu território e atiram em você.
Vence quem tiver mais território em 4 minutos, ou quem chegar a 50% do mapa antes.

## Como rodar

Precisa de [Node.js](https://nodejs.org) (testado com a v22).

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

| Comando                | O que faz                                                       |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento com recarga automática              |
| `npm test`             | Roda os testes (Vitest, em Node, sem navegador)                 |
| `npm run sim`          | Torneio de bots: milhares de partidas sem tela, pra medir mudanças nos bots |
| `npm run evolve`       | Busca evolutiva automática dos parâmetros de uma personalidade (~20 min) |
| `npm run typecheck`    | Só checa os tipos                                               |
| `npm run build`        | Build de produção em `dist/`                                    |
| `npm run build:single` | Gera **um único `.html`** em `dist-single/`, pra mandar a alguém |

> **Não abra o `index.html` da raiz pelo Live Server nem por duplo clique.** Ele aponta pra `src/main.ts` e o navegador
> não executa TypeScript: a página aparece sem mapa e com o placar vazio. Use `npm run dev`, ou abra o arquivo gerado
> por `npm run build:single` (`dist-single/index.html`), que funciona em qualquer servidor estático e até por duplo clique.

## Controles

| Tecla / mouse                    | Ação                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `WASD` ou setas                  | Andar pelas ruas (nos cruzamentos, vira pra rua mais alinhada) |
| Botão direito                    | Fincar bandeira (parado num cruzamento). 3+, depois volte à 1ª pra fechar |
| Espaço ou botão esquerdo         | Atirar pra frente, pela rua                                 |
| `M`                              | Visão geral do mapa                                         |
| Roda do mouse                    | Zoom                                                        |
| `R`                              | Nova partida (novo mapa)                                    |
| `N`                              | Liga/desliga o som                                          |

### No telefone (deitado)

Os controles de toque aparecem sozinhos em aparelhos de toque: um **joystick** que surge onde você pousar o polegar
esquerdo, e à direita os botões de **atirar** (segure) e **fincar bandeira**. No canto de cima há botões pequenos de mapa,
som, reiniciar e tela cheia. Com o aparelho em pé, o jogo pausa e pede pra girá-lo. Pra testar no celular, rode
`npm run dev -- --host` e abra o endereço de rede que o Vite mostrar (computador e telefone na mesma rede wi-fi), ou use
o modo de dispositivo do Chrome (F12 → ícone de celular).

Cada bot joga de um jeito: o **vermelho** caça bandeiras e quem lidera, o **roxo** é cauteloso e o **laranja** é guloso
(detalhes em [`docs/BOTS.md`](docs/BOTS.md)). Eles desviam dos seus tiros e dão preferência a quem está ganhando.

Dicas: encostar numa bandeira inimiga **destrói a cadeia inteira** do dono; andar em território próprio é 20% mais rápido;
morrer faz você perder as bandeiras que ainda não fechou.

## Mapas reproduzíveis

Todo mapa nasce de uma semente (aparece no console do navegador). Abra `http://localhost:5173/?seed=123` pra jogar o mesmo
mapa de novo, com as mesmas decisões iniciais dos bots.

## Ajustando o jogo

Todos os parâmetros (velocidades, número de bots, tamanho do mapa, tempo de partida, modo de tiro...) estão em
[`src/config.ts`](src/config.ts), cada um com um comentário dizendo o que faz.
Em desenvolvimento, `__game.CFG` no console permite mexer neles ao vivo.

## Estrutura

```
src/
  main.ts        liga tudo e roda o laço principal
  game.ts        cria partidas e avança a simulação um frame
  config.ts      parâmetros do jogo e times
  types.ts       tipos compartilhados
  core/          gerador de números aleatórios com semente
  map/           grafo de ruas, quarteirões, mapa procedural
  entities/      agentes, movimento pelas ruas, tiros
  rules/         bandeiras, laços, mortes, placar, combate
  ai/            os bots: decisões, percepção de perigo, planejamento, combate
  input/ render/ audio/ ui/    tudo que toca no navegador
tests/           testes automáticos
sim/             torneio de bots (`npm run sim`) e busca evolutiva (`npm run evolve`)
docs/            arquitetura e explicação dos bots
```

Mais detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e [`docs/BOTS.md`](docs/BOTS.md).

> O arquivo original, de um só HTML, continua em `stupid territorialism.html` como referência.
