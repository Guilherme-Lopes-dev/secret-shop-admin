import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from 'dayjs'
import { formatCurrency } from '../formatCurrency'
import { formatCpfCnpj } from '../formatCpfCnpj'

export interface ReceiptRow {
  sale_uuid: string
  order_number: string
  username: string | null
  total_amount: number
  created_at: string
  asaas_payment_id: string
  receipt_url: string | null
  invoice_url: string | null
  bank_slip_url: string | null
  customer_cpf_cnpj: string | null
  customer_name: string | null
  error: string | null
}


interface PeriodFilter {
  from?: string
  to?: string
}

const formatPeriod = (filters: PeriodFilter) => {
  const from = filters.from ? dayjs(filters.from).format('DD/MM/YYYY') : '-'
  const to = filters.to ? dayjs(filters.to).format('DD/MM/YYYY') : '-'
  return `${from} ate ${to}`
}

const pickUrl = (row: ReceiptRow): string | null =>
  row.receipt_url || row.invoice_url || row.bank_slip_url || null

export function generateBulkReceiptsPdf(receipts: ReceiptRow[], filters: PeriodFilter) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Comprovantes Asaas - Indice', 14, 22)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text(`Gerado em ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`, 14, 30)
  doc.text(`Periodo: ${formatPeriod(filters)}`, 14, 35)
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text('Dica: Ctrl+clique (ou Cmd+clique no Mac) abre o comprovante em nova aba.', 14, 40)
  doc.setTextColor(0)

  const linkColumnIndex = 5

  autoTable(doc, {
    startY: 46,
    head: [['#', 'Pedido', 'Cliente', 'CPF/CNPJ', 'Total', 'Comprovante']],
    body: receipts.map((r, i) => {
      const url = pickUrl(r)
      const label = r.error ? `Erro: ${r.error}` : url ? 'Abrir comprovante' : 'Sem URL'
      return [
        String(i + 1),
        r.order_number,
        r.customer_name || r.username || '-',
        formatCpfCnpj(r.customer_cpf_cnpj),
        formatCurrency(r.total_amount),
        label,
      ]
    }),
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 9 },
    columnStyles: {
      [linkColumnIndex]: { textColor: [37, 99, 235] },
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return
      if (data.column.index !== linkColumnIndex) return
      const row = receipts[data.row.index]
      if (!row) return
      const url = pickUrl(row)
      if (!url) return
      doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url })
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 8
  const totalSum = receipts.reduce((acc, r) => acc + (r.total_amount || 0), 0)
  const okCount = receipts.filter((r) => !r.error && pickUrl(r)).length
  const errorCount = receipts.length - okCount

  autoTable(doc, {
    startY: finalY,
    head: [['Sumario', '']],
    body: [
      ['Periodo', formatPeriod(filters)],
      ['Total de vendas pagas', String(receipts.length)],
      ['Comprovantes disponiveis', String(okCount)],
      ['Sem comprovante / erro', String(errorCount)],
      ['Somatoria dos valores', formatCurrency(totalSum)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [76, 175, 80] },
    bodyStyles: { fontStyle: 'bold' },
    styles: { fontSize: 10 },
  })

  const periodTag = `${filters.from ? dayjs(filters.from).format('YYYY-MM-DD') : 'inicio'}_${filters.to ? dayjs(filters.to).format('YYYY-MM-DD') : 'fim'}`
  doc.save(`comprovantes-asaas_${periodTag}.pdf`)
}
