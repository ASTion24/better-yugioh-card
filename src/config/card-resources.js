const REMOTE_RESOURCE_PATH = 'https://raw.githubusercontent.com/kooriookami/yugioh-card/92462bbd2aa3aa0075ebcc9b633bdc05137fd7ac/src/assets/yugioh-card';

export const CARD_RESOURCE_PATH = import.meta.env.VITE_CARD_RESOURCE_PATH ||
  (import.meta.env.DEV ? '/src/assets/yugioh-card' : REMOTE_RESOURCE_PATH);
