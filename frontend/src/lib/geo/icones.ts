// Ícones de mapa como SVG cru (string), sem depender de react-dom/server —
// renderToStaticMarkup funciona, mas puxa o renderer de servidor inteiro
// pro bundle do cliente só pra desenhar dois ícones pequenos.
import L from 'leaflet'

const BIKE_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>' +
  '<path d="M5.5 17.5h5l2-6h4.5M14.5 8.5h3l1 3"/>' +
  '<circle cx="15" cy="6" r="1.2" fill="#fff" stroke="none"/></svg>'

function pinSvg(size: number) {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24">` +
    '<path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" fill="#e0447a"/>' +
    '<circle cx="12" cy="10" r="3" fill="#fff"/></svg>'
  )
}

// Badge redondo com a moto sempre em pé + setinha por cima que gira com o
// heading — girar o ícone inteiro deixaria a moto de cabeça pra baixo em
// certas direções. counterRotation: quando o mapa em volta está
// rotacionado, cancela isso só na bolinha (a setinha continua livre,
// mostrando a direção real do heading).
export function motoDivIcon(heading: number | null, size = 36, counterRotation = 0) {
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px">
      <div style="position:absolute;inset:0;transform:rotate(${heading ?? 0}deg);transition:transform .25s">
        <div style="position:absolute;top:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #d5aa45"></div>
      </div>
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:linear-gradient(135deg,#e08a3a,#d5aa45 55%,#b57c27);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45);border:2px solid #fff;transform:rotate(${counterRotation}deg);transition:transform .1s">
        ${BIKE_SVG}
      </div>
    </div>
  `
  return L.divIcon({ className: 'icone-limpo', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

// counterRotation: quando o mapa em volta está rotacionado (trava de GPS
// ou gesto manual), passa o ângulo oposto aqui pro pino continuar sempre
// em pé na tela em vez de girar junto com o mapa.
export function destDivIcon(size = 30, counterRotation = 0) {
  return L.divIcon({
    className: 'icone-limpo',
    html: `<div style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));transform:rotate(${counterRotation}deg);transition:transform .1s">${pinSvg(size)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size * 0.917],
  })
}
