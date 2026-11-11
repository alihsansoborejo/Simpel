export interface PrintDocumentOptions {
  title: string;
  subtitle?: string;
  schoolName?: string;
  schoolAddress?: string;
  logoUrl?: string;
  metadata?: { label: string; value: string }[];
  signature?: {
    leftTitle?: string;
    leftName?: string;
    leftNip?: string;
    rightCityDate?: string;
    rightTitle?: string;
    rightName?: string;
    rightNip?: string;
  };
}

export function printDocumentDirectly(contentHtml: string, options: PrintDocumentOptions): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback jika popup terblokir di browser
    window.print();
    return;
  }

  const school = options.schoolName || "MI MA'ARIF AL IHSAN SOBOREJO";
  const address = options.schoolAddress || 'Soborejo, Pringsurat, Temanggung, Jawa Tengah - NSM: 111233230045 NPSN: 60712345';
  const logo = options.logoUrl || '/logo-mi-alihsan.svg';
  const metadataHtml = options.metadata && options.metadata.length > 0
    ? `
      <div class="print-meta-grid">
        ${options.metadata.map((m) => `
          <div class="print-meta-item">
            <span class="meta-label">${m.label}:</span>
            <span class="meta-value">${m.value}</span>
          </div>
        `).join('')}
      </div>
    `
    : '';

  const signatureHtml = options.signature
    ? `
      <div class="print-signature-section">
        <div class="sig-box">
          ${options.signature.leftTitle ? `<p class="sig-title">${options.signature.leftTitle}</p>` : ''}
          <div class="sig-space"></div>
          ${options.signature.leftName ? `<p class="sig-name"><u>${options.signature.leftName}</u></p>` : ''}
          ${options.signature.leftNip ? `<p class="sig-nip">NIP. ${options.signature.leftNip}</p>` : ''}
        </div>
        <div class="sig-box right">
          <p class="sig-date">${options.signature.rightCityDate || `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}</p>
          ${options.signature.rightTitle ? `<p class="sig-title">${options.signature.rightTitle}</p>` : '<p class="sig-title">Kepala Madrasah,</p>'}
          <div class="sig-space"></div>
          <p class="sig-name"><u>${options.signature.rightName || 'MUIN, S.Pd.I'}</u></p>
          <p class="sig-nip">NIP. ${options.signature.rightNip || '197508152005011004'}</p>
        </div>
      </div>
    `
    : '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${options.title} - ${school}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }
          /* KOP SURAT RESMI MADRASAH */
          .kop-container {
            display: flex;
            align-items: center;
            justify-content: center;
            border-bottom: 3px double #000;
            padding-bottom: 8px;
            margin-bottom: 16px;
            position: relative;
          }
          .kop-logo {
            width: 70px;
            height: 70px;
            object-fit: contain;
            position: absolute;
            left: 5px;
            top: 0;
          }
          .kop-text {
            text-align: center;
            width: 100%;
            padding: 0 80px;
          }
          .kop-kemenag {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .kop-yayasan {
            font-size: 12pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 2px 0 0;
          }
          .kop-madrasah {
            font-size: 14pt;
            font-weight: bold;
            color: #047857;
            text-transform: uppercase;
            margin: 2px 0;
            letter-spacing: 1px;
          }
          .kop-address {
            font-size: 8.5pt;
            color: #333;
            margin: 0;
            font-style: italic;
          }

          /* JUDUL DOKUMEN */
          .doc-header {
            text-align: center;
            margin: 16px 0;
          }
          .doc-title {
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            text-decoration: underline;
            margin: 0 0 4px 0;
            color: #000;
          }
          .doc-subtitle {
            font-size: 10pt;
            font-weight: normal;
            margin: 0;
            color: #444;
          }

          /* METADATA GRID */
          .print-meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px 16px;
            margin-bottom: 14px;
            padding: 8px 12px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            font-size: 9.5pt;
          }
          .print-meta-item {
            display: flex;
            align-items: baseline;
          }
          .meta-label {
            font-weight: bold;
            width: 140px;
            flex-shrink: 0;
          }
          .meta-value {
            color: #111;
          }

          /* TABEL DATA PRINT-READY */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0 16px 0;
            font-size: 9.5pt;
          }
          th, td {
            border: 1px solid #000;
            padding: 5px 8px;
            vertical-align: top;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
            font-size: 9pt;
          }
          td.center, th.center {
            text-align: center;
          }
          td.right, th.right {
            text-align: right;
          }
          tr {
            page-break-inside: avoid;
          }

          /* TANDA TANGAN DOKUMEN */
          .print-signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            page-break-inside: avoid;
            font-size: 10pt;
          }
          .sig-box {
            width: 250px;
            text-align: center;
          }
          .sig-box.right {
            margin-left: auto;
          }
          .sig-date {
            margin: 0 0 4px 0;
          }
          .sig-title {
            margin: 0 0 60px 0;
            font-weight: bold;
          }
          .sig-space {
            height: 60px;
          }
          .sig-name {
            font-weight: bold;
            margin: 0;
          }
          .sig-nip {
            margin: 2px 0 0;
            font-size: 9pt;
          }

          /* PRINT BUTTON JIKA DIBUKA MANUAL */
          .no-print {
            text-align: right;
            padding: 10px;
            background: #e2e8f0;
          }
          .btn-print {
            background: #047857;
            color: #fff;
            border: none;
            padding: 8px 16px;
            font-weight: bold;
            border-radius: 4px;
            cursor: pointer;
          }

          @media print {
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">Cetak / Simpan Sebagai PDF</button>
        </div>

        <!-- KOP RESMI -->
        <div class="kop-container">
          <img src="${logo}" alt="Logo Madrasah" class="kop-logo" onerror="this.style.display='none'" />
          <div class="kop-text">
            <p class="kop-kemenag">LEMBAGA PENDIDIKAN MA'ARIF NU KABUPATEN TEMANGGUNG</p>
            <p class="kop-yayasan">MADRASAH IBTIDAIYAH</p>
            <h1 class="kop-madrasah">${school}</h1>
            <p class="kop-address">${address}</p>
          </div>
        </div>

        <!-- HEADER DOKUMEN -->
        <div class="doc-header">
          <h2 class="doc-title">${options.title}</h2>
          ${options.subtitle ? `<p class="doc-subtitle">${options.subtitle}</p>` : ''}
        </div>

        ${metadataHtml}

        <!-- KONTEN UTAMA -->
        <div class="print-body">
          ${contentHtml}
        </div>

        <!-- TANDA TANGAN -->
        ${signatureHtml}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
