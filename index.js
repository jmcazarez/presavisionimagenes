const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = 3000;
const IMAGES_DIR = path.join(__dirname, 'imagenes');
let imagenLocal = null;

const URL_IFRAME = new URL('https://smn.conagua.gob.mx/tools/GUI/Visor_satelite.php');
URL_IFRAME.searchParams.set('id', '1');
URL_IFRAME.searchParams.set('panelEncabezado', '0');
URL_IFRAME.searchParams.set('panelHusosHorarios', '0');
URL_IFRAME.searchParams.set('satelite', 'GOES Este');
URL_IFRAME.searchParams.set('nombre', 'Noroeste de México');
URL_IFRAME.searchParams.set('tipo', 'Tope de Nubes');

async function capturarImagen() {
  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(URL_IFRAME.toString(), { waitUntil: 'networkidle2' });

    await page.waitForSelector('img', { timeout: 10000 });
    const imageUrl = await page.$eval('img', img => img.src);
    if (!imageUrl) throw new Error('No se encontró imagen dentro del visor');

    const view = await page.goto(imageUrl);
    const buffer = await view.buffer();

    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);
    const fileName = `noroeste-topenubes-${Date.now()}.jpg`;
    const filePath = path.join(IMAGES_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    imagenLocal = path.join('imagenes', fileName);
    console.log(`✅ Imagen guardada: ${fileName}`);
  } catch (err) {
    console.error('❌ Error al capturar imagen:', err.message);
  } finally {
    if (browser) await browser.close();
  }
}


cron.schedule('* * * * *', capturarImagen);
capturarImagen();

app.use('/imagenes', express.static(IMAGES_DIR));

app.get('/ultima-imagen', (req, res) => {
  if (!imagenLocal) return res.status(404).json({ error: 'Aún no hay imagen' });
  res.sendFile(path.join(__dirname, imagenLocal));
});

app.get('/imagen-base64', (req, res) => {
  if (!imagenLocal) return res.status(404).json({ error: 'Aún no hay imagen' });
  try {
    const buffer = fs.readFileSync(path.join(__dirname, imagenLocal));
    res.json({
      mimeType: 'image/jpeg',
      base64: `data:image/jpeg;base64,${buffer.toString('base64')}`
    });
  } catch (e) {
    res.status(500).json({ error: 'Error al leer imagen', detalles: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
