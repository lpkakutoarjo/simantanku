// GANTI STRING DI BAWAH DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbzDGnkecfM4C786jJ2XMz4iEMrNiHNalKR_xjY2JKSYYwe22SFJ0KnHqbxbDhHG8bP9/exec";

// Variabel global penyimpan data
let allBudgetedData = [];
let trendChartInstance = null;
let pieChartInstance = null;

// Fungsi Format Rupiah (bersih tanpa desimal)
const formatRp = (angka) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(angka);
};

// Fungsi Animasi Counter untuk Angka di Kartu
const animateValue = (id, start, end, duration, isCurrency = true, isPercent = false) => {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.floor(easeProgress * (end - start) + start);
        
        if (isCurrency) {
            obj.innerHTML = formatRp(current);
        } else if (isPercent) {
            obj.innerHTML = current.toFixed(2) + '%';
        } else {
            obj.innerHTML = current;
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if(isPercent) obj.innerHTML = end.toFixed(2) + '%';
        }
    };
    window.requestAnimationFrame(step);
};

// Fetch API & NORMALISASI DATA
async function loadData() {
    const tbody = document.getElementById('table-body');
    
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if (result.status === "success") {
            
            // --- PROSES NORMALISASI DATA (MENGATASI MERGE CELLS & BARIS TOTAL) ---
            let currentTahun = "";
            let currentBulan = "";
            let normalizedData = [];

            result.data.forEach(row => {
                let jp = String(row['Jenis Program'] || "").trim().toLowerCase();
                let th = String(row.Tahun || "").trim().toLowerCase();
                
                // 1. Abaikan baris "Total" dari Google Sheets agar tidak terhitung ganda
                if(jp === 'total' || th === 'total') return;

                // 2. Isi otomatis sel Tahun yang kosong (efek merge cells) dengan data dari atasnya
                if (row.Tahun && String(row.Tahun).trim() !== "") {
                    currentTahun = row.Tahun;
                } else {
                    row.Tahun = currentTahun;
                }

                // 3. Isi otomatis sel Bulan yang kosong dengan data dari atasnya
                if (row.Bulan && String(row.Bulan).trim() !== "") {
                    currentBulan = row.Bulan;
                } else {
                    row.Bulan = currentBulan;
                }

                // Masukkan ke array jika nama programnya ada
                if (row['Jenis Program'] && String(row['Jenis Program']).trim() !== "") {
                    normalizedData.push(row);
                }
            });

            allBudgetedData = normalizedData;
            // --------------------------------------------------------------------
            
            populateFilters();
            applyFilters(); 
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="state-message">⚠️ Gagal memuat data dari server.</td></tr>`;
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        tbody.innerHTML = `<tr><td colspan="5" class="state-message">🔌 Koneksi error. Pastikan URL API benar dan perangkat terhubung internet.</td></tr>`;
    }
}

// Mengisi Dropdown Filter Dinamis
function populateFilters() {
    const filterTahun = document.getElementById('filter-tahun');
    const filterBulan = document.getElementById('filter-bulan');
    
    // Reset option untuk mencegah duplikasi jika diload ulang
    filterTahun.innerHTML = '<option value="Semua">Semua Tahun</option>';
    filterBulan.innerHTML = '<option value="Semua">Semua Bulan</option>';
    
    const years = new Set();
    const months = new Set();

    allBudgetedData.forEach(row => {
        if(row.Tahun) years.add(row.Tahun);
        if(row.Bulan) months.add(row.Bulan);
    });

    Array.from(years).sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        filterTahun.appendChild(option);
    });

    const monthOrder = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    Array.from(months)
        .sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))
        .forEach(month => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            filterBulan.appendChild(option);
    });

    // Mencegah multiple event listener
    filterTahun.replaceWith(filterTahun.cloneNode(true));
    filterBulan.replaceWith(filterBulan.cloneNode(true));
    
    document.getElementById('filter-tahun').addEventListener('change', applyFilters);
    document.getElementById('filter-bulan').addEventListener('change', applyFilters);
}

// Logika Filter Data
function applyFilters() {
    const selectedTahun = document.getElementById('filter-tahun').value;
    const selectedBulan = document.getElementById('filter-bulan').value;

    const filteredData = allBudgetedData.filter(row => {
        const matchTahun = (selectedTahun === "Semua" || String(row.Tahun) === selectedTahun);
        const matchBulan = (selectedBulan === "Semua" || String(row.Bulan).toLowerCase() === selectedBulan.toLowerCase());
        return matchTahun && matchBulan;
    });

    renderDashboard(filteredData);
}

// Render UI Dashboard
function renderDashboard(data) {
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-foot');
    const thead = document.querySelector('thead tr');
    
    const selectedTahun = document.getElementById('filter-tahun').value;
    const selectedBulan = document.getElementById('filter-bulan').value;

    // LOGIKA BARU: 
    // Munculkan kolom tambahan jika Filter Bulan adalah "Semua"
    const showMonthColumn = (selectedBulan === "Semua");
    // Munculkan kolom tahun hanya jika Filter Tahun juga "Semua"
    const showYearColumn = (selectedTahun === "Semua");

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    // 1. Update bagian Header
    // Menghitung colspan untuk Grand Total nantinya
    let extraCols = 0;
    if (showYearColumn) extraCols++;
    if (showMonthColumn) extraCols++;

    thead.innerHTML = `
        ${showYearColumn ? '<th style="width: 8%;">Tahun</th>' : ''}
        ${showMonthColumn ? '<th style="width: 10%;">Bulan</th>' : ''}
        <th style="text-align: left; padding-left: 15px;">Jenis Program</th>
        <th style="width: 12%;">Pagu</th>
        <th style="width: 12%;">Realisasi</th>
        <th style="width: 8%;">%</th>
        <th style="width: 15%;">Sisa Anggaran</th>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${5 + extraCols}" class="state-message">📭 Tidak ada data.</td></tr>`;
        return;
    }

    let totalPagu = 0, totalRealisasi = 0, totalSisa = 0;
    let lastTahun = "";
    let lastBulan = "";

    data.forEach((row, index) => {
        let pagu = Number(row.Pagu) || 0;
        let realisasi = Number(row.Realisasi) || 0;
        let sisa = Number(row['Sisa Anggaran']) || (pagu - realisasi);

        totalPagu += pagu;
        totalRealisasi += realisasi;
        totalSisa += sisa;

        let rowPersentase = pagu > 0 ? ((realisasi / pagu) * 100).toFixed(2) : 0;

        // Grouping text logic
        let displayTahun = (row.Tahun !== lastTahun) ? row.Tahun : "";
        let displayBulan = (row.Bulan !== lastBulan || row.Tahun !== lastTahun) ? row.Bulan : "";

        lastTahun = row.Tahun;
        lastBulan = row.Bulan;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            ${showYearColumn ? `<td style="font-weight:bold; color: #2c3e50; background-color: #f8f9fa;">${displayTahun}</td>` : ''}
            ${showMonthColumn ? `<td style="font-weight:bold; color: #2c3e50; background-color: #f8f9fa;">${displayBulan}</td>` : ''}
            <td style="text-align: left;"><strong>${row['Jenis Program'] || '-'}</strong></td>
            <td>${formatRp(pagu)}</td>
            <td>${formatRp(realisasi)}</td>
            <td><span style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${rowPersentase}%</span></td>
            <td>${formatRp(sisa)}</td>
        `;
        tbody.appendChild(tr);

        // 3. Logika Sub-Total (Muncul jika bulan "Semua")
        if (showMonthColumn) {
            let nextRow = data[index + 1];
            if (!nextRow || nextRow.Tahun !== row.Tahun || nextRow.Bulan !== row.Bulan) {
                let subData = data.filter(d => d.Tahun === row.Tahun && d.Bulan === row.Bulan);
                let subPagu = subData.reduce((sum, d) => sum + Number(d.Pagu), 0);
                let subReal = subData.reduce((sum, d) => sum + Number(d.Realisasi), 0);
                let subSisa = subPagu - subReal;
                let subPersen = subPagu > 0 ? ((subReal / subPagu) * 100).toFixed(2) : 0;

                const trSub = document.createElement('tr');
                trSub.className = "subtotal-row";
                trSub.style.backgroundColor = "#fff4e6";
                trSub.style.fontWeight = "bold";
                trSub.innerHTML = `
                    <td colspan="${extraCols + 1}" style="text-align:left; padding-left: 15px;">TOTAL ${row.Bulan.toUpperCase()} ${row.Tahun}</td>
                    <td>${formatRp(subPagu)}</td>
                    <td>${formatRp(subReal)}</td>
                    <td>${subPersen}%</td>
                    <td>${formatRp(subSisa)}</td>
                `;
                tbody.appendChild(trSub);
            }
        }
    });

    // 4. Grand Total di Footer
    let persentaseTotal = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100) : 0;
    tfoot.innerHTML = `
        <tr style="background: #f39c12; color: white; font-weight: bold;">
            <td colspan="${extraCols + 1}" style="text-align: left; padding-left: 15px;">GRAND TOTAL</td>
            <td>${formatRp(totalPagu)}</td>
            <td>${formatRp(totalRealisasi)}</td>
            <td>${persentaseTotal.toFixed(2)}%</td>
            <td>${formatRp(totalSisa)}</td>
        </tr>
    `;

    // Update Kartu & Chart
    animateValue('total-pagu', 0, totalPagu, 1000);
    animateValue('total-realisasi', 0, totalRealisasi, 1000);
    animateValue('total-persentase', 0, persentaseTotal, 1000, false, true);
    animateValue('total-sisa', 0, totalSisa, 1000);

    renderCharts(data);
}

function renderCharts(filteredData) {
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    const ctxPie = document.getElementById('pieChart').getContext('2d');

    // Hancurkan chart sebelumnya agar tidak tumpang tindih saat data berubah
    if (trendChartInstance) trendChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    // --- 1. LOGIKA LINE CHART (TREN BULANAN) ---
    const monthOrder = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    // Hitung total realisasi per bulan dari data yang sudah difilter
    const monthlyValues = monthOrder.map(m => {
        return filteredData
            .filter(d => d.Bulan === m)
            .reduce((sum, d) => sum + (Number(d.Realisasi) || 0), 0);
    });

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: monthOrder,
            datasets: [{
                label: 'Realisasi (Rp)',
                data: monthlyValues,
                borderColor: '#4e73df',
                backgroundColor: 'rgba(78, 115, 223, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#4e73df'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Grafik Serapan Anggaran per Bulan', font: { size: 16 } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => formatRp(value) } }
            }
        }
    });

    // --- 2. LOGIKA PIE/DOUGHNUT CHART (KOMPOSISI PROGRAM) ---
    // Mengelompokkan realisasi berdasarkan Jenis Program dari data yang difilter
    const programMap = filteredData.reduce((acc, curr) => {
        const progName = curr['Jenis Program'];
        const realisasi = Number(curr.Realisasi) || 0;
        if (realisasi > 0) {
            acc[progName] = (acc[progName] || 0) + realisasi;
        }
        return acc;
    }, {});

    const pieLabels = Object.keys(programMap);
    const pieValues = Object.values(programMap);

    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues,
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#5a5c69', '#f39c12'],
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Komposisi Realisasi Program', font: { size: 16 } },
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
            }
        }
    });
}
function resetCards() {
    document.getElementById('total-pagu').innerText = "Rp 0";
    document.getElementById('total-realisasi').innerText = "Rp 0";
    document.getElementById('total-persentase').innerText = "0%";
    document.getElementById('total-sisa').innerText = "Rp 0";
}
function updateRealtimeDate() {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const today = new Date();
    
    // Mengambil tanggal yang sudah diformat (contoh: Selasa, 31 Maret 2026)
    const formattedDate = today.toLocaleDateString('id-ID', options);
    
    // Menambahkan teks "Per Tanggal" di depannya
    document.getElementById('current-date').innerText = "Per Tanggal " + formattedDate;
}

// Jalankan fungsi saat halaman dimuat
updateRealtimeDate();
// Inisialisasi saat load
window.addEventListener('DOMContentLoaded', loadData);