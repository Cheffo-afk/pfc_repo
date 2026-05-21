# pfc_repo
progetto fine corso
*Sviluppo di una applicazione Web Full Stack per chat 1-to-1 e videochiamata p2p*

L'applicazione presenta backend sviluppato in Express, gestisce DB tramite ORM Prisma ed autenticazione express/session
Il frontend è sviluppato in React Vite con l'ausilio di librerie MUI per le componenti e React Router per la gestione della navigazione
Lo scambio dati e la connessione p2p viaggiano attraverso WebSocket
____________________________________________________

Dopo aver inserito .env 
BACKEND:
  DATABASE_URL="mysql://*YOUR USER*:*YOUR PASSWORD*@localhost:*YOUR PORT*/MSG_Services"
  
  CORS_ORIGINS="http://localhost:(YOUR PORT)"

  # Profilo amministratore bootstrap automatico.
  ADMIN_EMAIL="EXAMPLE@EMAIL.X"
  ADMIN_USERNAME="YOUR USERNAME"
  ADMIN_PASSWORD="YOUR PASSWORD"

  # Session secret per autenticazione server-side (express-session).
  SESSION_SECRET="change-this-session-secret"
FRONTEND:
  VITE_API_BASE_URL=/api
  VITE_WS_URL=ws://localhost:*YOUR WS PORT*/ws

ed aver scaricato i node_modules con npm install nelle rispettive directori

Modificare eventualmente lo schema Prisma per le vostre esigenze di DB (attualmente usa MYSQL)

Effetuare la migrazione Prisma con npx prisma migrate dev
___________________________________________________

A questo punto si possono avviare backend e frontend singolarmente 
dalle rispettive directory con "npm run dev".

Altrimenti si può avvivare dalla directory superiore con:
____________________________________________________

powershell -ExecutionPolicy Bypass -File start-dev.ps1
____________________________________________________

Quest'ultimo libera le porte per l'avvio del backend e del frontend ed attende la risposta dal 
backend prima di avviare il frontend per evitare errori di sincrono con la web socket
