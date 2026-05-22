import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from 'dayjs'
import { formatCurrency } from '../formatCurrency'

interface SaleItem {
  skin_name?: string
  quantity?: number
  unit_price?: number
  discount_applied?: number
  price?: number
}

interface StatusHistory {
  to?: string
  at?: string
  by?: string
}

interface Sale {
  id?: string | number
  uuid?: string
  order_number?: string
  payment_status?: string
  fulfillment_status?: string
  subtotal_amount?: number
  discount_amount?: number
  total_amount?: number
  created_at?: string
  ip_address?: string
  ip_country?: string
  anti_fraud_score?: number
  idempotency_key?: string
  asaas_payment_id?: string
  users?: { username?: string; email?: string; trade_link?: string; contact?: string; uuid?: string; id?: string }
  sale_items?: SaleItem[]
  status_history?: StatusHistory[]
}

interface PeriodFilter {
  from?: string
  to?: string
  payment_status?: string
}

const formatDate = (val?: string) => (val ? dayjs(val).format('DD/MM/YYYY HH:mm:ss') : '-')
const formatPeriod = (filters: PeriodFilter) => {
  const from = filters.from ? dayjs(filters.from).format('DD/MM/YYYY') : '-'
  const to = filters.to ? dayjs(filters.to).format('DD/MM/YYYY') : '-'
  return `${from} ate ${to}`
}

function renderSale(doc: jsPDF, sale: Sale, index: number, total: number) {
  let y = 15

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Venda ${index + 1}/${total} - Pedido #${sale.order_number || '-'}`, 14, y)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text(`UUID: ${String(sale.id || sale.uuid || '-')}`, 14, y)
  doc.setTextColor(0)
  y += 6

  autoTable(doc, {
    startY: y,
    head: [['Dados Gerais', '']],
    body: [
      ['Order Number', sale.order_number || '-'],
      ['Status Pagamento', sale.payment_status || '-'],
      ['Status Entrega', sale.fulfillment_status || '-'],
      ['Criado em', formatDate(sale.created_at)],
      ['Asaas Payment ID', sale.asaas_payment_id || '-'],
      ['Idempotency Key', sale.idempotency_key || '-'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 4

  autoTable(doc, {
    startY: y,
    head: [['Cliente', '']],
    body: [
      ['Usuario', sale.users?.username || '-'],
      ['Email', sale.users?.email || '-'],
      ['Contato', sale.users?.contact || '-'],
      ['UUID', sale.users?.id || sale.users?.uuid || '-'],
      ['Trade Link', sale.users?.trade_link || '-'],
      ['IP', sale.ip_address || '-'],
      ['Pais IP', sale.ip_country || '-'],
      ['Antifraude Score', String(sale.anti_fraud_score ?? '-')],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 4

  const items = sale.sale_items || []
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Qtd', 'Preco Unit.', 'Desconto', 'Subtotal']],
    body: items.length
      ? items.map((i) => [
          i.skin_name || '-',
          String(i.quantity ?? 1),
          formatCurrency(i.unit_price),
          formatCurrency(i.discount_applied),
          formatCurrency(i.price),
        ])
      : [['Sem itens', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 8 },
  })
  y = (doc as any).lastAutoTable.finalY + 4

  autoTable(doc, {
    startY: y,
    head: [['Totais', '']],
    body: [
      ['Subtotal', formatCurrency(sale.subtotal_amount)],
      ['Desconto', formatCurrency(sale.discount_amount)],
      ['Total', formatCurrency(sale.total_amount)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [76, 175, 80] },
    bodyStyles: { fontStyle: 'bold' },
    styles: { fontSize: 9 },
  })
  y = (doc as any).lastAutoTable.finalY + 4

  const history = sale.status_history || []
  if (history.length) {
    autoTable(doc, {
      startY: y,
      head: [['Status', 'Data', 'Por']],
      body: history.map((h) => [h.to || '-', formatDate(h.at), h.by || '-']),
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 7 },
    })
  }
}

function renderCover(doc: jsPDF, sales: Sale[], filters: PeriodFilter) {
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatorio Consolidado de Vendas', 14, 22)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120)
  doc.text(`Gerado em ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`, 14, 30)
  doc.setTextColor(0)

  const subtotalSum = sales.reduce((acc, s) => acc + (s.subtotal_amount || 0), 0)
  const discountSum = sales.reduce((acc, s) => acc + (s.discount_amount || 0), 0)
  const totalSum = sales.reduce((acc, s) => acc + (s.total_amount || 0), 0)

  autoTable(doc, {
    startY: 38,
    head: [['Resumo do Periodo', '']],
    body: [
      ['Periodo', formatPeriod(filters)],
      ['Status filtro', filters.payment_status || 'TODOS'],
      ['Vendas no relatorio', String(sales.length)],
      ['Subtotal somado', formatCurrency(subtotalSum)],
      ['Descontos somados', formatCurrency(discountSum)],
      ['Total somado', formatCurrency(totalSum)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 10 },
  })

  const startY = (doc as any).lastAutoTable.finalY + 6
  autoTable(doc, {
    startY,
    head: [['#', 'Pedido', 'Cliente', 'Data', 'Total']],
    body: sales.map((s, i) => [
      String(i + 1),
      s.order_number || '-',
      s.users?.username || '-',
      formatDate(s.created_at),
      formatCurrency(s.total_amount),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 8 },
  })
}

export function generateBulkSalesReportPdf(sales: Sale[], filters: PeriodFilter) {
  const doc = new jsPDF()
  renderCover(doc, sales, filters)

  sales.forEach((sale, idx) => {
    doc.addPage()
    renderSale(doc, sale, idx, sales.length)
  })

  const periodTag = `${filters.from ? dayjs(filters.from).format('YYYY-MM-DD') : 'inicio'}_${filters.to ? dayjs(filters.to).format('YYYY-MM-DD') : 'fim'}`
  doc.save(`relatorio-vendas_${periodTag}.pdf`)
}
