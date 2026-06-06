import DefaultTheme from 'vitepress/theme';
import Landing from './Landing.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: Landing,
};
