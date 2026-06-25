export type GameConfig = {
  slug: string;
  name: string;
  description: string;
  compatibility: Array<'pc' | 'cell'>;
};

export const games: GameConfig[] = [
  {
    slug: 'jogo-exemplo',
    name: 'Jogo Exemplo',
    description: 'Jogo de demonstracao para validar a estrutura.',
    compatibility: ['pc'],
  },
  {
    slug: 'lightcycle-arena',
    name: 'Lightcycle Arena',
    description: 'Corrida de motos de luz estilo Tron: cerque o oponente com seu rastro sem bater nas paredes nem na trilha. Treina reflexo, planejamento e raciocínio espacial.',
    compatibility: ['pc'],
  },
];
