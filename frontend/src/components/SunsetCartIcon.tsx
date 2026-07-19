// Uiverse.io by abhinav_7137 — reproduzido fiel à referência (mesmo
// carrinho SVG, mesmos 5 itens caindo em sequência: celular, notebook,
// tablet, headphone, mixer), sem o texto "Loading..." (não faz sentido
// num botão fixo). `withItems` liga os itens caindo — usado no botão
// flutuante do carrinho; no ícone pequeno do cabeçalho (escala minúscula)
// fica só o carrinho balançando, os itens some no tamanho.
export default function SunsetCartIcon({ scale = 1, withItems = false }: { scale?: number; withItems?: boolean }) {
  if (!withItems) {
    return <div id="cart-icon" style={{ transform: `scale(${scale})` }} />
  }
  return (
    <div className="cart-loader" style={{ transform: `scale(${scale})` }}>
      <div className="items-container">
        <div id="item-mobile" className="item" />
        <div id="item-laptop" className="item" />
        <div id="item-tab" className="item" />
        <div id="item-headphone" className="item" />
        <div id="item-mixer" className="item" />
      </div>
      <div id="cart-icon" />
    </div>
  )
}
