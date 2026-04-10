// GANTI STRING DI BAWAH DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbzDGnkecfM4C786jJ2XMz4iEMrNiHNalKR_xjY2JKSYYwe22SFJ0KnHqbxbDhHG8bP9/exec";

let allBudgetedData = [];
let trendChartInstance = null;
let pieChartInstance = null;

const formatRp = (angka) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(angka);
};

const animateValue = (id, start, end, duration, isCurrency = true, isPercent = false) => {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = Math.floor(easeProgress * (end - start) + start);
        if (isCurrency) obj.innerHTML = formatRp(current);
        else if (isPercent) obj.innerHTML = current.toFixed(2) + '%';
        else obj.innerHTML = current;
        if (progress < 1) window.requestAnimationFrame(step);
        else if(isPercent) obj.innerHTML = end.toFixed(2) + '%';
    };
    window.requestAnimationFrame(step);
};

async function loadData() {
    const tbody = document.getElementById('table-body');
    const dbStatus = document.getElementById('db-status');
    const dbText = document.getElementById('status-text');
    
    dbStatus.className = "date-badge-glass badge-sm db-status-loading";
    dbText.innerText = "Menghubungkan Database...";

    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if (result.status === "success") {
            dbStatus.className = "date-badge-glass badge-sm db-status-success";
            dbText.innerText = "Database Terhubung";

            let currentTahun = "";
            let currentBulan = "";
            let normalizedData = [];

            result.data.forEach(row => {
                let jp = String(row['Kegiatan'] || "").trim().toLowerCase();
                let th = String(row.Tahun || "").trim().toLowerCase();
                if(jp === 'total' || th === 'total') return;

                if (row.Tahun && String(row.Tahun).trim() !== "") currentTahun = row.Tahun;
                else row.Tahun = currentTahun;

                if (row.Bulan && String(row.Bulan).trim() !== "") currentBulan = row.Bulan;
                else row.Bulan = currentBulan;

                if (row['Kegiatan'] && String(row['Kegiatan']).trim() !== "") {
                    normalizedData.push(row);
                }
            });

            allBudgetedData = normalizedData;
            populateFilters();
            applyFilters(); 
        } else {
            dbStatus.className = "date-badge-glass badge-sm db-status-error";
            dbText.innerText = "Gagal Mengambil Data";
            tbody.innerHTML = `<tr><td colspan="5" class="state-message">⚠️ Gagal memuat data dari server.</td></tr>`;
        }
    } catch (error) {
        dbStatus.className = "date-badge-glass badge-sm db-status-error";
        dbText.innerText = "Koneksi Terputus";
        tbody.innerHTML = `<tr><td colspan="5" class="state-message">🔌 Koneksi error. Pastikan URL API benar dan perangkat terhubung internet.</td></tr>`;
    }
}

function populateFilters() {
    let filterTahun = document.getElementById('filter-tahun');
    let filterBulan = document.getElementById('filter-bulan');
    
    filterTahun.innerHTML = '<option value="Semua">Semua Tahun</option>';
    filterBulan.innerHTML = '<option value="Semua">Semua Bulan</option>';
    
    const years = new Set();
    const months = new Set();

    allBudgetedData.forEach(row => {
        if(row.Tahun) years.add(row.Tahun);
        if(row.Bulan) months.add(row.Bulan);
    });

    // Mengambil dan mengurutkan tahun dari yang terbaru ke terlama
    const sortedYearsArray = Array.from(years).sort().reverse();

    sortedYearsArray.forEach(year => {
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

    // 1. Lakukan cloneNode terlebih dahulu (untuk reset event listener)
    const newFilterTahun = filterTahun.cloneNode(true);
    const newFilterBulan = filterBulan.cloneNode(true);
    
    filterTahun.replaceWith(newFilterTahun);
    filterBulan.replaceWith(newFilterBulan);
    
    // 2. SET VALUE SETELAH CLONE (Ini kunci perbaikannya agar tidak ter-reset)
    if (sortedYearsArray.length > 0) {
        newFilterTahun.value = sortedYearsArray[0];
    }

    // 3. Pasang kembali event listener pada elemen yang baru
    newFilterTahun.addEventListener('change', applyFilters);
    newFilterBulan.addEventListener('change', applyFilters);
}

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

function renderDashboard(data) {
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-foot');
    const thead = document.querySelector('thead');

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    thead.innerHTML = `
        <tr>
            <th class="prominent-header" style="width: 35%; text-align: left;">Kegiatan</th>
            <th class="prominent-header" style="width: 15%;">Pagu</th>
            <th class="prominent-header" style="width: 15%;">Realisasi</th>
            <th class="prominent-header" style="width: 15%;">Persentase (%)</th>
            <th class="prominent-header" style="width: 20%;">Sisa Anggaran</th>
        </tr>
    `;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-message" style="text-align:center; padding:2rem;">📭 Tidak ada data pada filter ini.</td></tr>`;
        
        document.getElementById('total-pagu').innerText = "Rp 0";
        document.getElementById('total-realisasi').innerText = "Rp 0";
        document.getElementById('total-persentase').innerText = "0%";
        document.getElementById('total-sisa').innerText = "Rp 0";
        
        if (trendChartInstance) trendChartInstance.destroy();
        if (pieChartInstance) pieChartInstance.destroy();
        return;
    }

    let totalPagu = 0, totalRealisasi = 0, totalSisa = 0;

    const groupedByYear = {};
    
    data.forEach(row => {
        let year = String(row.Tahun);
        let month = String(row.Bulan);
        let pagu = Number(row.Pagu) || 0;
        let real = Number(row.Realisasi) || 0;

        totalPagu += pagu;
        totalRealisasi += real;

        if (!groupedByYear[year]) {
            groupedByYear[year] = { tahun: year, subPagu: 0, subReal: 0, months: {} };
        }
        
        groupedByYear[year].subPagu += pagu;
        groupedByYear[year].subReal += real;

        if (!groupedByYear[year].months[month]) {
            groupedByYear[year].months[month] = { bulan: month, subPagu: 0, subReal: 0, items: [] };
        }
        
        groupedByYear[year].months[month].subPagu += pagu;
        groupedByYear[year].months[month].subReal += real;
        groupedByYear[year].months[month].items.push(row);
    });

    totalSisa = totalPagu - totalRealisasi;

    const sortedYears = Object.values(groupedByYear).sort((a, b) => Number(b.tahun) - Number(a.tahun));
    const monthNames = { "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6, "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12 };

    let groupIndex = 0;

    sortedYears.forEach(yearGroup => {
        const trYear = document.createElement('tr');
        trYear.style.backgroundColor = '#f1f5f9'; 
        trYear.style.borderBottom = '2px solid #cbd5e1';
        
        trYear.innerHTML = `
            <td colspan="5" style="text-align:left; padding-left: 15px; color: var(--primary-dark);">
                <strong style="font-size: 1.05rem; letter-spacing: 0.5px;">📂 TAHUN ${yearGroup.tahun}</strong>
            </td>
        `;
        tbody.appendChild(trYear);

        const sortedMonths = Object.values(yearGroup.months).sort((a, b) => {
            const monthA = monthNames[a.bulan.toLowerCase()] || 0;
            const monthB = monthNames[b.bulan.toLowerCase()] || 0;
            return monthB - monthA;
        });

        sortedMonths.forEach(monthGroup => {
            const subSisa = monthGroup.subPagu - monthGroup.subReal;
            const subPersen = monthGroup.subPagu > 0 ? ((monthGroup.subReal / monthGroup.subPagu) * 100).toFixed(2) : 0;

            const trGroup = document.createElement('tr');
            trGroup.className = "month-group-row";
            trGroup.setAttribute('data-target', `detail-${groupIndex}`);
            
            trGroup.onclick = function() {
                this.classList.toggle('open');
                const targetClass = this.getAttribute('data-target');
                const details = document.querySelectorAll(`.${targetClass}`);
                details.forEach(d => d.classList.toggle('show-detail'));
            };

            trGroup.innerHTML = `
                <td style="text-align:left; padding-left: 35px;">
                    <div style="display:flex; align-items:center;">
                        <span class="toggle-icon">▶</span>
                        <strong>${monthGroup.bulan.toUpperCase()} ${yearGroup.tahun}</strong>
                        <span style="font-size:0.75rem; color:#64748b; margin-left:10px; font-weight:normal;">(Klik rincian)</span>
                    </div>
                </td>
                <td><strong>${formatRp(monthGroup.subPagu)}</strong></td>
                <td><strong>${formatRp(monthGroup.subReal)}</strong></td>
                <td><span class="badge-percent">${subPersen}%</span></td>
                <td><strong>${formatRp(subSisa)}</strong></td>
            `;
            tbody.appendChild(trGroup);

            monthGroup.items.forEach(row => {
                let pagu = Number(row.Pagu) || 0;
                let realisasi = Number(row.Realisasi) || 0;
                let sisa = Number(row['Sisa Anggaran']) || (pagu - realisasi);
                let rowPersentase = pagu > 0 ? ((realisasi / pagu) * 100).toFixed(2) : 0;

                const trDetail = document.createElement('tr');
                trDetail.className = `detail-row detail-${groupIndex}`;
                
                // PERUBAHAN: Span titik poin (▪) sudah dihapus dari baris ini
                trDetail.innerHTML = `
                    <td style="text-align: left; padding-left: 60px; color: var(--text-muted);">
                        ${row['Kegiatan'] || '-'}
                    </td>
                    <td>${formatRp(pagu)}</td>
                    <td>${formatRp(realisasi)}</td>
                    <td>${rowPersentase}%</td>
                    <td>${formatRp(sisa)}</td>
                `;
                tbody.appendChild(trDetail);
            });

            groupIndex++;
        });
    });

    let persentaseTotal = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100) : 0;
    
    tfoot.innerHTML = `
        <tr style="background: var(--primary-dark); color: white; font-weight: bold;">
            <td style="text-align: left; padding-left: 15px;">GRAND TOTAL KESELURUHAN</td>
            <td>${formatRp(totalPagu)}</td>
            <td>${formatRp(totalRealisasi)}</td>
            <td>${persentaseTotal.toFixed(2)}%</td>
            <td>${formatRp(totalSisa)}</td>
        </tr>
    `;

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

    const monthOrder = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const monthlyValues = monthOrder.map(m => {
        return filteredData.filter(d => d.Bulan === m).reduce((sum, d) => sum + (Number(d.Realisasi) || 0), 0);
    });

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: monthOrder,
            datasets: [{
                label: 'Realisasi (Rp)', data: monthlyValues, borderColor: '#4e73df', backgroundColor: 'rgba(78, 115, 223, 0.1)', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#4e73df'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Grafik Serapan Anggaran per Bulan', font: { size: 16 } } },
            scales: { y: { beginAtZero: true, ticks: { callback: value => formatRp(value) } } }
        }
    });

    const programMap = filteredData.reduce((acc, curr) => {
        const progName = curr['Kegiatan'];
        const realisasi = Number(curr.Realisasi) || 0;
        if (realisasi > 0) acc[progName] = (acc[progName] || 0) + realisasi;
        return acc;
    }, {});

    const pieLabels = Object.keys(programMap);
    const pieValues = Object.values(programMap);

    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: pieLabels,
            datasets: [{
                data: pieValues, backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#5a5c69', '#f39c12'], hoverOffset: 10
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Komposisi Realisasi Kegiatan', font: { size: 16 } }, legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } }
        }
    });
}

function updateRealtimeDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date().toLocaleDateString('id-ID', options);
    document.getElementById('current-date').innerText = "Hari " + formattedDate;
}

updateRealtimeDate();
window.addEventListener('DOMContentLoaded', loadData);
