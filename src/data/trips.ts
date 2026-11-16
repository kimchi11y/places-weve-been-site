// The app's six example trips (seed/trips in places-weve-been), trimmed to what the page shows.
export interface Stop { name: string; code: string; coord: [lng: number, lat: number]; photos: string[] }
export interface Trip {
  id: string; title: string; word: string; year: number; dates: string; days: number;
  country: string; numeric: string[]; ink: string; tint: string; summary: string; stops: Stop[];
}

export const photo = (trip: string, name: string, w: 480 | 1100 = 480) => `/img/${trip}/${name}-${w}.webp`;

export const trips: Trip[] = [
  {
    id: 'iceland-2021', title: 'Iceland', word: 'Iceland', year: 2021, dates: '14 – 20 Aug 2021', days: 7,
    country: 'IS', numeric: ['352'], ink: '#1C6CB5', tint: '#D3E7F9',
    summary: 'A week under the midnight sun, with black beaches, puffins and icebergs.',
    stops: [
      { name: 'Reykjavík', code: 'REK', coord: [-21.94, 64.15], photos: ['reykjavik-1'] },
      { name: 'Vík', code: 'VIK', coord: [-19.01, 63.42], photos: ['vik-1'] },
      { name: 'Jökulsárlón', code: 'JKL', coord: [-16.18, 64.05], photos: ['jokulsarlon-1'] },
    ],
  },
  {
    id: 'morocco-2022', title: 'Morocco', word: 'Morocco', year: 2022, dates: '2 – 10 Dec 2022', days: 9,
    country: 'MA', numeric: ['504'], ink: '#2A7A4B', tint: '#D5ECD4',
    summary: 'Spice markets, blue streets and the patience of very kind carpet sellers.',
    stops: [
      { name: 'Marrakech', code: 'RAK', coord: [-7.99, 31.63], photos: ['marrakech-1'] },
      { name: 'Fes', code: 'FEZ', coord: [-5, 34.03], photos: ['fes-1'] },
      { name: 'Chefchaouen', code: 'CHF', coord: [-5.27, 35.17], photos: ['chefchaouen-1', 'chefchaouen-2'] },
    ],
  },
  {
    id: 'seoul-busan-2023', title: 'Seoul & Busan', word: 'Korea', year: 2023, dates: '6 – 15 Oct 2023', days: 10,
    country: 'KR', numeric: ['410'], ink: '#7A3FA3', tint: '#E8DBF6',
    summary: 'Our first time in Korea. Palaces, street food and a fast train down to the sea.',
    stops: [
      { name: 'Seoul', code: 'SEL', coord: [126.98, 37.57], photos: ['seoul-1', 'seoul-2'] },
      { name: 'Gyeongju', code: 'GJU', coord: [129.22, 35.86], photos: ['gyeongju-1'] },
      { name: 'Busan', code: 'PUS', coord: [129.08, 35.18], photos: ['busan-1'] },
    ],
  },
  {
    id: 'japan-2024', title: 'Japan', word: 'Japan', year: 2024, dates: '28 Mar – 9 Apr 2024', days: 13,
    country: 'JP', numeric: ['392'], ink: '#A35E00', tint: '#FCE8B6',
    summary: 'Thirteen days of cherry blossoms, bullet trains and convenience-store egg sandwiches.',
    stops: [
      { name: 'Tokyo', code: 'TYO', coord: [139.69, 35.69], photos: ['tokyo-1', 'tokyo-2'] },
      { name: 'Hakone', code: 'HKN', coord: [139.03, 35.23], photos: ['hakone-1'] },
      { name: 'Kyoto', code: 'KYO', coord: [135.77, 35.01], photos: ['kyoto-1', 'kyoto-2'] },
      { name: 'Osaka', code: 'OSA', coord: [135.5, 34.69], photos: ['osaka-1'] },
    ],
  },
  {
    id: 'jeju-2025', title: 'Jeju Island', word: 'Jeju', year: 2025, dates: '3 – 8 Apr 2025', days: 6,
    country: 'KR', numeric: ['410'], ink: '#C22A66', tint: '#FBD7E4',
    summary: 'Slow island days among volcanoes, tangerine farms and black-stone walls.',
    stops: [
      { name: 'Jeju City', code: 'CJU', coord: [126.53, 33.5], photos: ['jeju-city-1'] },
      { name: 'Seongsan', code: 'SSN', coord: [126.94, 33.46], photos: ['seongsan-1', 'seongsan-2'] },
      { name: 'Seogwipo', code: 'SGP', coord: [126.56, 33.25], photos: ['seogwipo-1'] },
    ],
  },
  {
    id: 'austria-germany-2025', title: 'Austria – Germany', word: 'Austria', year: 2025, dates: '18 – 27 Sep 2025', days: 10,
    country: 'AT', numeric: ['040', '276'], ink: '#D23F2B', tint: '#FFDCD2',
    summary: 'Lakes, mountains and far too much cake, from Munich’s beer gardens to Vienna’s grand cafés.',
    stops: [
      { name: 'Munich', code: 'MUC', coord: [11.58, 48.14], photos: ['munich-1', 'munich-2'] },
      { name: 'Salzburg', code: 'SZG', coord: [13.04, 47.8], photos: ['salzburg-1', 'salzburg-2'] },
      { name: 'Hallstatt', code: 'HAL', coord: [13.65, 47.56], photos: ['hallstatt-1', 'hallstatt-2'] },
      { name: 'Vienna', code: 'VIE', coord: [16.37, 48.21], photos: ['vienna-1', 'vienna-2'] },
    ],
  },
];

export const REPO = 'https://github.com/kimchi11y/places-weve-been';
