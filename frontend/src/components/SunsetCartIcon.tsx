// O #cart-icon exato do Uiverse by abhinav_7137 (mesmo SVG/animação já
// usado no CartFab) virou o ícone padrão de carrinho em TODO botão do
// site que leva pro carrinho/checkout — reaproveitado aqui pra não
// duplicar o SVG em cada lugar que precisa dele.
export default function SunsetCartIcon({ scale = 0.45 }: { scale?: number }) {
  return <div id="cart-icon" style={{ transform: `scale(${scale})` }} />
}
