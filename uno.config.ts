import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  preflights: [
    {
      getCSS: () => `
html, body, #root {
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}
body {
  font-family: 'Inter', 'Noto Sans JP', 'Helvetica Neue', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'MS PGothic', sans-serif;
  font-feature-settings: 'ss02';
  text-autospace: normal;
  background: #f5f5f5;
  color: #333;
}
button, input, textarea, select {
  font-family: inherit;
  font-feature-settings: inherit;
}
`,
    },
  ],
});
