import { createApp } from 'vue';
import App from './App.vue';
import 'normalize.css';
import '@/styles/main.scss';

const cardId = new URLSearchParams(location.search).get('card');
if (cardId) {
  location.replace(`./editor/?card=${encodeURIComponent(cardId)}`);
} else {
  createApp(App).mount('#app');
}
