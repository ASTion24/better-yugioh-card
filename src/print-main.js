import { createApp } from 'vue';
import PrintApp from './PrintApp.vue';
import 'normalize.css';
import '@/styles/main.scss';

const app = createApp(PrintApp);

app.mount('#app');
