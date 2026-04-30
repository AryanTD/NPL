// Shared franchise metadata — colors, short names, cities.
// Source of truth for both lobby and auction pages.

export const FRANCHISE_META: Record<string, { shortName: string; primary: string; secondary: string; city: string }> = {
  'Kathmandu Gorkhas':   { shortName: 'KTM', primary: '#1B3A6B', secondary: '#C9A84C', city: 'Kathmandu'    },
  'Pokhara Avengers':    { shortName: 'PKR', primary: '#C0392B', secondary: '#FFFFFF', city: 'Pokhara'      },
  'Chitwan Rhinos':      { shortName: 'CHT', primary: '#196F3D', secondary: '#F4D03F', city: 'Chitwan'      },
  'Biratnagar Kings':    { shortName: 'BRT', primary: '#6C3483', secondary: '#F9E79F', city: 'Biratnagar'   },
  'Janakpur Bolts':      { shortName: 'JNK', primary: '#1A5276', secondary: '#F39C12', city: 'Janakpur'     },
  'Lumbini Lions':       { shortName: 'LMB', primary: '#922B21', secondary: '#FAD7A0', city: 'Lumbini'      },
  'Sudurpaschim Royals': { shortName: 'SDR', primary: '#0E6655', secondary: '#A9DFBF', city: 'Sudurpaschim' },
  'Karnali Yaks':        { shortName: 'KRN', primary: '#4A235A', secondary: '#D7BDE2', city: 'Karnali'      },
};

export function meta(franchiseName: string) {
  return FRANCHISE_META[franchiseName] ?? { shortName: '???', primary: '#5b6f9a', secondary: '#e4e9f4', city: '' };
}
