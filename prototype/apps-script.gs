/**
 * Crée — mini backend Google Apps Script
 * 1. Créez une feuille Google Sheets, puis Extensions > Apps Script, collez ce code.
 * 2. Déployer > Nouveau déploiement > Application web (exécuter en tant que : vous, accès : tout le monde).
 * 3. Copiez l'URL : dans le formulaire (constante ENDPOINT) et dans Crée Studio (Réglages > Source des demandes).
 */
const SHEET = 'Demandes';

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
}

// Réception d'une demande envoyée par le formulaire
function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  const id = Utilities.getUuid();
  sheet_().appendRow([id, new Date().toISOString(), JSON.stringify(data)]);
  // Alerte e-mail facultative :
  // MailApp.sendEmail(Session.getActiveUser().getEmail(), 'Nouvelle demande : ' + (data.nom || ''), JSON.stringify(data, null, 2));
  return ContentService.createTextOutput(JSON.stringify({ ok: true, id })).setMimeType(ContentService.MimeType.JSON);
}

// Lecture de toutes les demandes par Crée Studio
function doGet() {
  const rows = sheet_().getDataRange().getValues().filter(r => r[0]);
  const out = rows.map(r => Object.assign({ id: r[0], receivedAt: r[1] }, JSON.parse(r[2] || '{}')));
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
