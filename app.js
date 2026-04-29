// Data model: array of objek pengeluaran
let expenses = [];     

// Elemen DOM
const expenseNameInput = document.getElementById('expenseName');
const expenseAmountInput = document.getElementById('expenseAmount');
const expenseCategorySelect = document.getElementById('expenseCategory');
const expenseForm = document.getElementById('expenseForm');
const expenseListBody = document.getElementById('expenseListBody');
const totalAmountSpan = document.getElementById('totalAmount');

// state untuk edit (jika sedang mengedit)
let editMode = false;
let editId = null;

// ======================= localStorage =======================
function loadDataFromLocalStorage() {
    const stored = localStorage.getItem('daily_expenses');
    if (stored) {
        try {
            expenses = JSON.parse(stored);
            // validasi sederhana: pastikan setiap item punya properti yang benar
            if (!Array.isArray(expenses)) expenses = [];
        } catch(e) { expenses = []; }
    } else {
        expenses = [];
    }
    // tambahan default jika kosong tidak perlu
}

function saveDataToLocalStorage() {
    localStorage.setItem('daily_expenses', JSON.stringify(expenses));
}

// menyimpan & merender ulang UI
function syncDataAndRender() {
    saveDataToLocalStorage();
    renderExpenseList();
    updateTotal();
}

// ======================= Hitung Total =======================
function updateTotal() {
    let total = 0;
    for (let item of expenses) {
        let amount = parseFloat(item.amount);
        if (!isNaN(amount)) total += amount;
    }
    // Format rupiah sederhana
    totalAmountSpan.innerText = formatRupiah(total);
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

// ======================= Render Tabel =======================
function renderExpenseList() {
    if (!expenseListBody) return;

    if (expenses.length === 0) {
        expenseListBody.innerHTML = `<tr class="empty-message"><td colspan="4">📭 Belum ada catatan. Silakan tambah pengeluaran!</td></tr>`;
        return;
    }

    let html = '';
    // menampilkan data terbaru di atas (terbaru berdasarkan id timestamp)
    const sortedExpenses = [...expenses].sort((a,b) => b.id - a.id);
    
    for (let exp of sortedExpenses) {
        // Format nominal dengan pemisah ribuan
        const formattedAmount = formatRupiah(exp.amount);
        html += `
            <tr data-id="${exp.id}">
                <td><strong>${escapeHtml(exp.name)}</strong></td>
                <td class="nominal-text">${formattedAmount}</td>
                <td><span class="kategori-badge">${escapeHtml(exp.category)}</span></td>
                <td class="action-cell">
                    <button class="btn-icon btn-edit" data-id="${exp.id}" data-action="edit" title="Edit data">✏️</button>
                    <button class="btn-icon btn-delete" data-id="${exp.id}" data-action="delete" title="Hapus">🗑️</button>
                </td>
            </tr>
        `;
    }
    expenseListBody.innerHTML = html;
}

// Escape HTML untuk keamanan
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

// Global event delegation untuk tombol hapus dan edit (dipasang sekali di body)
function setupGlobalDelegation() {
    document.body.addEventListener('click', function(e) {
        // tombol edit / hapus
        const btn = e.target.closest('.btn-icon');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const idStr = btn.getAttribute('data-id');
        if (!idStr) return;
        const id = parseInt(idStr, 10);
        if (isNaN(id)) return;

        if (action === 'delete') {
            e.preventDefault();
            if (confirm('Yakin ingin menghapus pengeluaran ini?')) {
                deleteExpenseById(id);
            }
        } else if (action === 'edit') {
            e.preventDefault();
            enableEditMode(id);
        }
    });
}

// Hapus data berdasarkan id
function deleteExpenseById(id) {
    const newExpenses = expenses.filter(exp => exp.id !== id);
    if (newExpenses.length === expenses.length) return;
    expenses = newExpenses;
    syncDataAndRender();
    // jika sedang dalam mode edit dan id yang dihapus adalah yang diedit, reset form
    if (editMode && editId === id) {
        resetFormMode();
    }
}

// Fungsi untuk mengaktifkan mode edit, mengisi form dengan data yang dipilih
function enableEditMode(id) {
    const expenseToEdit = expenses.find(exp => exp.id === id);
    if (!expenseToEdit) return;

    // isi form
    expenseNameInput.value = expenseToEdit.name;
    expenseAmountInput.value = expenseToEdit.amount;
    expenseCategorySelect.value = expenseToEdit.category;

    // ubah tombol submit menjadi "Update Data"
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '✏️ Update Pengeluaran';
    submitBtn.style.background = "linear-gradient(100deg, #2c7a5e, #1f5a44)";
    
    // set flag edit
    editMode = true;
    editId = id;

    // scroll ke form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFormMode() {
    // reset form
    expenseForm.reset();
    // set default category ke Makan agar tidak kosong (optional)
    expenseCategorySelect.value = "Makan";
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = '➕ Tambah Data';
    submitBtn.style.background = "linear-gradient(100deg, #2c6e9e, #1f4e72)";
    editMode = false;
    editId = null;
}

// Menambah atau update data
function handleAddOrUpdate(event) {
    event.preventDefault();

    // ambil value
    let name = expenseNameInput.value.trim();
    let amountRaw = expenseAmountInput.value.trim();
    let category = expenseCategorySelect.value;

    // validasi
    if (name === "") {
        alert("Nama pengeluaran tidak boleh kosong!");
        return;
    }
    if (amountRaw === "" || isNaN(parseFloat(amountRaw)) || parseFloat(amountRaw) < 0) {
        alert("Nominal harus diisi angka positif!");
        return;
    }
    const amount = parseFloat(amountRaw);
    if (amount === 0) {
        if (confirm("Nominal 0 Rupiah, apakah tetap ingin mencatat?")) {
            // tetap lanjut
        } else {
            return;
        }
    }

    if (editMode === true && editId !== null) {
        // Update data yang sudah ada
        const index = expenses.findIndex(exp => exp.id === editId);
        if (index !== -1) {
            expenses[index] = {
                ...expenses[index],
                name: name,
                amount: amount,
                category: category,
                updatedAt: Date.now()
            };
            syncDataAndRender();
            resetFormMode();
            // sedikit feedback
            showTemporaryMessage("Data berhasil diperbarui!");
        } else {
            alert("Data tidak ditemukan, mungkin sudah dihapus.");
            resetFormMode();
        }
    } else {
        // Tambah data baru
        const newExpense = {
            id: Date.now(),   // unique ID berdasarkan timestamp
            name: name,
            amount: amount,
            category: category,
            createdAt: Date.now()
        };
        expenses.push(newExpense);
        syncDataAndRender();
        // reset form
        expenseForm.reset();
        // set default kategori ke Makan lagi
        expenseCategorySelect.value = "Makan";
        // fokus ke input nama lagi
        expenseNameInput.focus();
        showTemporaryMessage("✅ Pengeluaran berhasil ditambahkan!");
    }
}

// fungsi notifikasi kecil (simple)
function showTemporaryMessage(msg) {
    // membuat toast sederhana
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#1f4e6e';
    toast.style.color = 'white';
    toast.style.padding = '0.7rem 1.4rem';
    toast.style.borderRadius = '3rem';
    toast.style.fontWeight = '500';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    toast.style.fontSize = '0.9rem';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 1800);
}

// Inisialisasi awal
function init() {
    loadDataFromLocalStorage();
    renderExpenseList();
    updateTotal();
    setupGlobalDelegation();
    expenseForm.addEventListener('submit', handleAddOrUpdate);
    
    // TAMBAHKAN tombol batal edit untuk user experience:
    const cancelEditBtn = document.createElement('button');
    cancelEditBtn.textContent = '❌ Batal Edit';
    cancelEditBtn.type = 'button';
    cancelEditBtn.style.marginTop = '0.6rem';
    cancelEditBtn.style.width = '100%';
    cancelEditBtn.style.padding = '0.6rem';
    cancelEditBtn.style.borderRadius = '2rem';
    cancelEditBtn.style.backgroundColor = '#eef2fa';
    cancelEditBtn.style.border = '1px solid #cddfe7';
    cancelEditBtn.style.color = '#2c6280';
    cancelEditBtn.style.fontWeight = '600';
    cancelEditBtn.style.cursor = 'pointer';
    cancelEditBtn.style.transition = '0.1s';
    cancelEditBtn.onclick = () => {
        if (editMode) {
            resetFormMode();
            showTemporaryMessage("Mode edit dibatalkan");
        } else {
            showTemporaryMessage("Tidak dalam mode edit");
        }
    };
    
    const existingCancel = document.getElementById('dynamicCancelBtn');
    if (!existingCancel) {
        cancelEditBtn.id = 'dynamicCancelBtn';
        const submitButton = document.getElementById('submitBtn');
        submitButton.parentNode.insertBefore(cancelEditBtn, submitButton.nextSibling);
    }
}

// Panggil init ketika window load
window.addEventListener('DOMContentLoaded', init);