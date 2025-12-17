const UIThemes = {
  cyberA: {
    name: 'Cyber Blue',
    primary: '#00F0FF',
    secondary: '#FF003C',
    accent: '#FFE600',
    background: '#02040A',
    surface: '#0F172A',
    text: '#E2E8F0',
    grid: '#00F0FF',
    danger: '#FF003C',
    win: '#FFE600',
  },
  cyberB: {
    name: 'Neo Purple',
    primary: '#9A4DFF',
    secondary: '#FF3366',
    accent: '#FFE082',
    background: '#0B0614',
    surface: '#16112A',
    text: '#EDE9FE',
    grid: '#7C3AED',
    danger: '#FF3366',
    win: '#FFE082',
  },
  cyberC: {
    name: 'Emerald Tech',
    primary: '#00E6A8',
    secondary: '#FF5C8D',
    accent: '#F5F3C4',
    background: '#02120F',
    surface: '#0D1F1A',
    text: '#D9F99D',
    grid: '#00E6A8',
    danger: '#FF5C8D',
    win: '#F5F3C4',
  },
  cyberD: {
    name: 'Amber Forge',
    primary: '#FFB020',
    secondary: '#FF3366',
    accent: '#FFE8A3',
    background: '#120A00',
    surface: '#1E1508',
    text: '#FFF4E0',
    grid: '#FFB020',
    danger: '#FF3366',
    win: '#FFE8A3',
  },
  cyberE: {
    name: 'Glitch Mint',
    primary: '#36FCA1',
    secondary: '#FF3D81',
    accent: '#E0FFE7',
    background: '#04120B',
    surface: '#0B1A12',
    text: '#E0FFE7',
    grid: '#36FCA1',
    danger: '#FF3D81',
    win: '#E0FFE7',
  },
};

class ThemeManager {
  constructor() {
    this.currentTheme = 'cyberA';
    this.subscribers = [];
  }

  setTheme(name) {
    if (!UIThemes[name]) return;
    this.currentTheme = name;
    const theme = UIThemes[name];
    this.subscribers.forEach((cb) => cb(theme));
  }

  getColor(key) {
    return UIThemes[this.currentTheme]?.[key];
  }

  subscribe(cb) {
    this.subscribers.push(cb);
    cb(UIThemes[this.currentTheme]);
  }
}

export const themeManager = new ThemeManager();
export { UIThemes };

