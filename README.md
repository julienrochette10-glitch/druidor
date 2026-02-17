# AirCode Scene Builder

Éditeur DOM sandbox local avec architecture modulaire Node.js + Vanilla JS.

## Démarrage

```bash
npm start
```

Ouvrir `http://localhost:3000`.

## Chargement initial

Utilisez le bouton **Charger fichiers** puis renseignez trois chemins relatifs au projet, par exemple :
- `examples/page.html`
- `examples/page.css`
- `examples/page.js`

## Architecture

- `public/scripts/editorState.js` : gestion d’état centralisée + undo/redo.
- `public/scripts/domSync.js` : parsing initial et synchronisation DOM/iframe sans reload complet à chaque modification.
- `public/scripts/toolEngine.js` : registre d’outils dynamique + application.
- `public/scripts/toolRenderer.js` : rendu UI dynamique des outils.
- `public/modules/tools.json` : persistance des outils.
- `server.js` : API fs pour charger/sauvegarder fichiers et outils.
