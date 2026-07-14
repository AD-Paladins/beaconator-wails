## Pendientes

### ✅ Set up shared/ architecture en beaconator-web

- [x] Crear `shared/` en beaconator-web con los mismos archivos que acá
- [x] Actualizar `jira.js` del web para aceptar tercer parámetro `options` (`maxResults`, `fields`)
- [x] Reemplazar `metrics.js` del web por la versión de `shared/` (usa `fetchJira()` en vez de `fetch()` directo)
- [x] Integrar `sync.sh` (copiar `sync-web.sh` → web y renombrar)
- [x] Verificar que los query params adicionales (`maxResults`, `fields`) no rompan el Cloudflare Worker CORS proxy
