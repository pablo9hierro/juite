import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'

// QR code de verdade (mesma lib usada em /pagamento pro Pix real,
// qrcode.react) — aqui só ilustrativo, sem cobrança nenhuma por trás. Uma
// linha vermelha fina varre de cima a baixo em loop, simulando o
// "escaneando" — o próprio QR pisca bem sutil no meio da passada, só pra
// reforçar a leitura.
const BOX_SIZE = 64

export default function QrScanMock() {
  return (
    <div
      className="relative flex-shrink-0 bg-white rounded-xl overflow-hidden shadow-inner"
      style={{ width: BOX_SIZE, height: BOX_SIZE }}
    >
      <motion.div
        animate={{ opacity: [1, 1, 0.8, 1, 1] }}
        transition={{ duration: 4.8, repeat: Infinity, times: [0, 0.55, 0.65, 0.75, 1], ease: 'easeInOut' }}
      >
        <QRCodeSVG value="SUNSET-TABAS-PIX-DEMO" size={BOX_SIZE} bgColor="#ffffff" fgColor="#0f2b1d" />
      </motion.div>
      <motion.div
        className="absolute left-0 right-0 h-[2px] bg-red-500"
        style={{ boxShadow: '0 0 6px 2px rgba(239,68,68,0.75)' }}
        animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.1, 0.9, 1] }}
      />
    </div>
  )
}
