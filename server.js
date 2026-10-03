require('dotenv').config();
const express = require('express');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Configurazione Web Push con le variabili d'ambiente VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Database temporaneo in memoria (sostituire con PostgreSQL/MongoDB in produzione)
const subscriptionsDB = [];

// 2. Endpoint per inviare la chiave pubblica al client
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// 3. Endpoint per registrare la sottoscrizione inviata dall'App
app.post('/api/subscribe', (req, res) => {
  const { subscription, targetPrice, userLocation } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Sottoscrizione non valida' });
  }

  // Salvataggio della sottoscrizione e dei criteri utente
  subscriptionsDB.push({
    subscription,
    targetPrice,
    userLocation,
    createdAt: new Date()
  });

  console.log(`[Push Server] Nuova iscrizione registrata per soglia: ${targetPrice} €/L`);
  res.status(201).json({ status: 'Sottoscrizione salvata con successo' });
});

// 4. Endpoint di test per inviare una notifica di prova
app.post('/api/send-test-notification', async (req, res) => {
  const payload = JSON.stringify({
    title: '⛽ Allerta Prezzo FuelSaver',
    body: 'Il Diesel ha raggiunto 1.629 €/L presso Eni vicino a te!',
    url: 'https://fuelsaver.app'
  });

  const pushPromises = subscriptionsDB.map(user => {
    return webpush.sendNotification(user.subscription, payload)
      .catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // La sottoscrizione è scaduta o revocata dall'utente, rimuovila
          console.log('[Push Server] Rimozione iscrizione non più valida');
          return null;
        }
        console.error('[Push Server] Errore invio notifica:', err);
      });
  });

  await Promise.all(pushPromises);
  res.json({ status: 'Notifiche inviate' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server Web Push attivo sulla porta ${PORT}`);
});