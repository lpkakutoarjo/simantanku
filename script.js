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
    
    // 1. Reset options
    filterBulan.innerHTML = '<option value="Semua">Semua Bulan</option>';
    
    const years = new Set();
    const months = new Set();

    allBudgetedData.forEach(row => {
        if(row.Tahun) years.add(String(row.Tahun));
        if(row.Bulan) months.add(row.Bulan);
    });

    // 2. Isi Dropdown Tahun
    Array.from(years).sort((a, b) => b - a).forEach(year => {
        filterTahun.add(new Option(year, year));
    });

    // 3. Isi Dropdown Bulan
    const monthOrder = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    Array.from(months)
        .sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))
        .forEach(month => {
            filterBulan.add(new Option(month, month));
        });

    // 4. Set Default Awal (Saat aplikasi pertama kali dibuka)
    const now = new Date();
    const currentMonthLabel = monthOrder[now.getMonth()];
    const currentYearLabel = now.getFullYear().toString();

    if (years.has(currentYearLabel)) filterTahun.value = currentYearLabel;
    if (months.has(currentMonthLabel)) filterBulan.value = currentMonthLabel;

    // 5. EVENT LISTENER DENGAN LOGIKA OTOMATIS
    filterTahun.onchange = function() {
        // SETIAP KALI TAHUN DIGANTI -> BULAN OTOMATIS KE "Semua"
        filterBulan.value = "Semua"; 
        applyFilters();
    };

    filterBulan.onchange = applyFilters;

    // Jalankan filter pertama kali
    applyFilters();
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

    if (trendChartInstance) trendChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    // 1. Ambil tahun yang sedang dipilih
    const selectedTahun = document.getElementById('filter-tahun').value;

    // --- LOGIKA LINE CHART (TREN TAHUNAN RESPONSIF) ---
    const monthOrder = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    // Pastikan kita memfilter allBudgetedData berdasarkan tahun yang aktif sebelum di-map
    const yearlyTrendData = monthOrder.map(m => {
        return allBudgetedData
            .filter(d => {
                // Konversi ke string untuk perbandingan yang aman
                const matchTahun = (selectedTahun === "Semua" || String(d.Tahun) === String(selectedTahun));
                const matchBulan = (String(d.Bulan) === m);
                return matchTahun && matchBulan;
            })
            .reduce((sum, d) => sum + (Number(d.Realisasi) || 0), 0);
    });

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: monthOrder,
            datasets: [{
                label: `Realisasi ${selectedTahun === "Semua" ? "Seluruh Tahun" : selectedTahun} (Rp)`,
                data: yearlyTrendData,
                borderColor: '#1e3a8a',
                backgroundColor: 'rgba(30, 58, 138, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                title: { 
                    display: true, 
                    text: `Tren Serapan Anggaran Tahun ${selectedTahun}`, 
                    font: { size: 16, weight: 'bold' },
                    padding: { bottom: 20 }
                },
                legend: { display: false } // Sembunyikan legend agar lebih bersih
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { 
                        callback: value => formatRp(value),
                        maxTicksLimit: 5
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // --- LOGIKA PIE CHART (MENGIKUTI FILTER BULAN) ---
    const programMap = filteredData.reduce((acc, curr) => {
        const progName = curr['Jenis Program'] || 'Lainnya';
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
                backgroundColor: ['#1e3a8a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'],
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { 
                    display: true, 
                    text: 'Komposisi Program', 
                    font: { size: 16, weight: 'bold' },
                    padding: { bottom: 10 }
                },
                legend: { 
                    position: 'bottom', 
                    labels: { boxWidth: 10, padding: 15, font: { size: 11 } } 
                }
            },
            cutout: '70%' // Membuat doughnut lebih tipis agar elegan
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
    document.getElementById('current-date').innerText = formattedDate;
}

// Jalankan fungsi saat halaman dimuat
updateRealtimeDate();
// Inisialisasi saat load
window.addEventListener('DOMContentLoaded', loadData);
