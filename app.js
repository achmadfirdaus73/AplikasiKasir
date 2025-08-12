const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

        // --- FIREBASE SETUP ---
        const firebaseConfig = {
            apiKey: "AIzaSyDEDMpuIPFskJ-eUrRWJBu5qYbLmN734_U",
            authDomain: "aplikasikasir-c2ddc.firebaseapp.com",
            projectId: "aplikasikasir-c2ddc",
            storageBucket: "aplikasikasir-c2ddc.appspot.com",
            messagingSenderId: "456279209391",
            appId: "1:456279209391:web:7a1298f1e1b2368d462b5a",
            measurementId: "G-9CBTDVJ3ZN"
        };
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();

        // --- UTILS ---
        const formatCurrency = (amount) => `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
        const formatTimestamp = (timestamp) => {
            if (!timestamp || !timestamp.toDate) return 'N/A';
            return dayjs(timestamp.toDate()).format('DD/MM/YYYY HH:mm');
        };

        // --- KOMPONEN-KOMPONEN VUE ---
        const LoginPage = {
            template: `
                <div class="flex-grow flex items-center justify-center">
                    <div class="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
                        <div class="bg-blue-500 text-white p-4 text-center text-xl font-bold">Kasir Pro - Login</div>
                        <form @submit.prevent="handleLogin" class="p-6">
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700">Email</label>
                                <input type="email" v-model="loginForm.email" class="mt-1 w-full p-2 border rounded-md shadow-sm" required />
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700">Password</label>
                                <input type="password" v-model="loginForm.password" class="mt-1 w-full p-2 border rounded-md shadow-sm" required />
                            </div>
                            <div v-if="loginError" class="text-red-500 text-sm mb-4">{{ loginError }}</div>
                            <button type="submit" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Login</button>
                        </form>
                    </div>
                </div>
            `,
            setup() {
                const loginForm = reactive({ email: '', password: '' });
                const loginError = ref(null);
                const handleLogin = async () => {
                    loginError.value = null;
                    try { await auth.signInWithEmailAndPassword(loginForm.email, loginForm.password); } catch (error) { loginError.value = "Email atau password salah."; }
                };
                return { loginForm, loginError, handleLogin };
            }
        };

        const PosPage = {
            props: ['products', 'cartItems'],
            emits: ['update:cartItems', 'show-snackbar', 'open-payment-dialog'],
            template: `
                <div class="md:grid md:grid-cols-12 gap-4 h-full">
                    <div class="col-span-7 flex flex-col h-full">
                        <input type="text" placeholder="Cari produk..." v-model="searchTerm" class="w-full p-2 border rounded-md mb-4" />
                        <div class="flex space-x-2 overflow-x-auto mb-4 pb-2">
                            <button v-for="category in categories" :key="category" @click="selectedCategory = category" :class="['whitespace-nowrap px-4 py-2 rounded-full font-semibold', selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700']">{{ category }}</button>
                        </div>
                        <div class="product-grid flex flex-wrap -mx-2">
                            <div v-for="product in filteredProducts" :key="product.id" class="p-2 w-1/2 sm:w-1/3 lg:w-1/4">
                                <div :class="['product-card bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full', product.stock <= 0 ? 'product-card-disabled' : '']" @click="addToCart(product)">
                                    <div class="relative w-full h-32 flex-shrink-0">
                                        <img :src="product.image || 'https://placehold.co/400x400/EFEFEF/333333?text=Produk'" :alt="product.name" class="w-full h-full object-cover" />
                                        <span v-if="product.stock <= 0" class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">Stok Habis</span>
                                    </div>
                                    <div class="p-2 text-center mt-auto"><p class="font-bold text-gray-800">{{ product.name }}</p><p class="text-blue-500 font-semibold">{{ formatCurrency(product.price) }}</p></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-span-5 bg-white rounded-lg shadow-md p-4 cart-section mt-4 md:mt-0">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold">Pesanan Saat Ini</h2>
                            <button v-if="cartItems.length > 0" @click="clearCart" class="text-red-500 hover:text-red-700"><i class="mdi mdi-cart-remove text-2xl"></i></button>
                        </div>
                        <div class="border-t border-gray-200 mb-4"></div>
                        <div class="cart-items">
                            <p v-if="cartItems.length === 0" class="text-center text-gray-500">Keranjang masih kosong</p>
                            <div v-else v-for="item in cartItems" :key="item.id" class="flex items-center justify-between p-2 border-b">
                                <div class="flex-grow"><p class="font-semibold">{{ item.name }}</p><p class="text-sm text-gray-500">{{ formatCurrency(item.price) }}</p></div>
                                <div class="flex items-center gap-2">
                                    <button @click="decreaseQuantity(item)" class="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"><i class="mdi mdi-minus text-sm"></i></button>
                                    <span class="font-bold">{{ item.quantity }}</span>
                                    <button @click="increaseQuantity(item)" class="p-1 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"><i class="mdi mdi-plus text-sm"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="border-t border-gray-200 my-4"></div>
                        <div class="space-y-2">
                            <div class="flex justify-between"><span>Subtotal</span><span class="font-bold">{{ formatCurrency(cartSubtotal) }}</span></div>
                            <div class="flex justify-between"><span>Pajak (11%)</span><span class="font-bold">{{ formatCurrency(cartTax) }}</span></div>
                            <div class="border-t border-gray-200 pt-2"></div>
                            <div class="flex justify-between text-lg"><span>Total</span><span class="font-bold text-blue-500">{{ formatCurrency(cartTotal) }}</span></div>
                        </div>
                        <button @click="$emit('open-payment-dialog')" :disabled="cartItems.length === 0" class="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-md text-lg disabled:opacity-50"><i class="mdi mdi-cash-multiple mr-2"></i> Proses Pembayaran</button>
                    </div>
                </div>`,
            setup(props, { emit }) {
                const searchTerm = ref('');
                const selectedCategory = ref('Semua');
                const categories = computed(() => ['Semua', ...new Set(props.products.map(p => p.category))].filter(Boolean));
                const filteredProducts = computed(() => props.products.filter(p => (selectedCategory.value === 'Semua' || p.category === selectedCategory.value) && p.name.toLowerCase().includes(searchTerm.value.toLowerCase())));
                const cartSubtotal = computed(() => props.cartItems.reduce((total, item) => total + (item.price * item.quantity), 0));
                const cartTax = computed(() => Math.round(cartSubtotal.value * 0.11));
                const cartTotal = computed(() => cartSubtotal.value + cartTax.value);
                const updateCart = (newCart) => emit('update:cartItems', newCart);
                const addToCart = (product) => { if (product.stock <= 0) return; const newCart = [...props.cartItems]; const existingItem = newCart.find(item => item.id === product.id); if (existingItem) { if (existingItem.quantity < product.stock) existingItem.quantity++; else emit('show-snackbar', { text: `Stok ${product.name} tidak mencukupi!`, color: 'bg-yellow-500' }); } else { newCart.push({ ...product, quantity: 1 }); } updateCart(newCart); };
                const increaseQuantity = (item) => { const productInDb = props.products.find(p => p.id === item.id); if (item.quantity < productInDb.stock) { updateCart(props.cartItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)); } else { emit('show-snackbar', { text: `Stok ${item.name} tidak mencukupi!`, color: 'bg-yellow-500' }); } };
                const decreaseQuantity = (item) => { if (item.quantity > 1) { updateCart(props.cartItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)); } else { updateCart(props.cartItems.filter(i => i.id !== item.id)); } };
                const clearCart = () => updateCart([]);
                return { searchTerm, selectedCategory, categories, filteredProducts, cartSubtotal, cartTax, cartTotal, addToCart, increaseQuantity, decreaseQuantity, clearCart, formatCurrency };
            }
        };

        const AdminPage = {
            props: ['products', 'salesHistory'],
            emits: ['show-snackbar', 'open-product-dialog'],
            template: `
                <div class="p-4">
                    <div class="flex flex-wrap gap-2 mb-4 border-b">
                        <button @click="adminTab = 'dashboard'" :class="tabClass('dashboard')">Dashboard</button>
                        <button @click="adminTab = 'daily_report'" :class="tabClass('daily_report')">Laporan Harian</button>
                        <button @click="adminTab = 'products'" :class="tabClass('products')">Manajemen Produk</button>
                        <button @click="adminTab = 'sales'" :class="tabClass('sales')">Riwayat Penjualan</button>
                    </div>
                    <div v-if="adminTab === 'dashboard'" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div class="bg-green-100 p-4 rounded-lg text-center"><h3 class="text-xl font-bold text-green-700">Pendapatan Hari Ini</h3><p class="text-3xl font-bold text-green-500 mt-2">{{ formatCurrency(todaysRevenue) }}</p></div>
                            <div class="bg-blue-100 p-4 rounded-lg text-center"><h3 class="text-xl font-bold text-blue-700">Transaksi Hari Ini</h3><p class="text-3xl font-bold text-blue-500 mt-2">{{ todaysTransactionCount }}</p></div>
                            <div class="bg-gray-100 p-4 rounded-lg"><h3 class="text-xl font-bold text-center mb-2">Produk Terlaris</h3>
                                <ul v-if="topSellingProducts.length > 0" class="list-inside text-left"><li v-for="(item, i) in topSellingProducts" :key="i" class="flex items-center gap-2 mb-1"><span class="bg-blue-500 text-white px-2 rounded-full text-sm">{{ i + 1 }}</span> {{ item.name.split(' - ')[0] }} ({{ item.sold }} terjual)</li></ul>
                                <p v-else class="text-center text-gray-500">Belum ada penjualan hari ini.</p>
                            </div>
                        </div>
                        <div class="p-4 bg-white rounded-lg shadow-md"><h3 class="text-xl font-bold mb-4">Grafik Penjualan 7 Hari Terakhir</h3><canvas ref="salesChartRef"></canvas></div>
                    </div>
                    <div v-if="adminTab === 'daily_report'" class="p-4 bg-white rounded-lg shadow-md">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold">Laporan Penjualan Harian</h2>
                            <div class="flex gap-2">
                                <button @click="downloadReportTxt" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md">Download TXT</button>
                                <button @click="printDailyReport" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Cetak Laporan</button>
                            </div>
                        </div>
                        <div class="mb-4"><label class="block text-sm font-medium text-gray-700">Pilih Tanggal</label><input type="date" v-model="reportDate" class="mt-1 p-2 block w-auto border rounded-md" /></div>
                        <div id="daily-report-print-area">
                            <h3 class="text-lg font-bold mb-4">Laporan untuk Tanggal: {{ dayjs(reportDate).format('dddd, D MMMM YYYY') }}</h3>
                            <div class="grid md:grid-cols-2 gap-4">
                                <div class="bg-gray-50 p-4 rounded-lg"><h4 class="font-bold mb-2">Ringkasan Omzet</h4><p>Total Omzet: <span class="font-bold text-green-500">{{ formatCurrency(dailyReport.totalRevenue) }}</span></p><p>Jumlah Transaksi: <span class="font-bold">{{ dailyReport.transactionCount }}</span></p></div>
                                <div class="bg-gray-50 p-4 rounded-lg"><h4 class="font-bold mb-2">Rincian per Metode Pembayaran</h4>
                                    <ul v-if="Object.keys(dailyReport.paymentMethods).length > 0"><li v-for="([method, value]) in Object.entries(dailyReport.paymentMethods)" :key="method">{{ method }}: <span class="font-bold">{{ formatCurrency(value) }}</span></li></ul>
                                    <p v-else class="text-gray-500">Tidak ada transaksi.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-if="adminTab === 'products'" class="p-4 bg-white rounded-lg shadow-md">
                        <div class="flex justify-between items-center mb-4"><h2 class="text-xl font-bold">Manajemen Produk</h2><button @click="$emit('open-product-dialog')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Tambah Produk</button></div>
                        <div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase text-right">Aksi</th></tr></thead>
                            <tbody class="bg-white divide-y divide-gray-200"><tr v-for="item in products" :key="item.id"><td class="px-6 py-4 whitespace-nowrap">{{ item.name }}</td><td class="px-6 py-4 whitespace-nowrap">{{ formatCurrency(item.price) }}</td><td class="px-6 py-4 whitespace-nowrap">{{ item.category }}</td><td class="px-6 py-4 whitespace-nowrap"><span :class="stockClass(item.stock)">{{ item.stock }}</span></td><td class="px-6 py-4 whitespace-nowrap text-right"><button @click="$emit('open-product-dialog', item)" class="p-1 rounded-full text-indigo-600 hover:bg-gray-100"><i class="mdi mdi-pencil"></i></button><button @click="deleteProduct(item)" class="p-1 rounded-full text-red-600 hover:bg-gray-100"><i class="mdi mdi-delete"></i></button></td></tr></tbody>
                        </table></div>
                    </div>
                    <div v-if="adminTab === 'sales'" class="p-4 bg-white rounded-lg shadow-md">
                        <h2 class="text-xl font-bold mb-4">Riwayat Penjualan</h2>
                        <div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kasir</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metode</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jml Item</th></tr></thead>
                            <tbody class="bg-white divide-y divide-gray-200"><tr v-for="item in salesHistory" :key="item.id"><td class="px-6 py-4 whitespace-nowrap">{{ formatTimestamp(item.createdAt) }}</td><td class="px-6 py-4 whitespace-nowrap">{{ item.cashier.name }}</td><td class="px-6 py-4 whitespace-nowrap">{{ formatCurrency(item.total) }}</td><td class="px-6 py-4 whitespace-nowrap">{{ item.paymentMethod }}</td><td class="px-6 py-4 whitespace-nowrap">{{ item.items.length }}</td></tr></tbody>
                        </table></div>
                    </div>
                </div>`,
            setup(props, { emit }) {
                const adminTab = ref('dashboard');
                const salesChartRef = ref(null);
                let salesChartInstance = null;
                const reportDate = ref(dayjs().format('YYYY-MM-DD'));
                const todaysSales = computed(() => props.salesHistory.filter(s => dayjs(s.createdAt?.toDate()).isSame(dayjs(), 'day')));
                const todaysRevenue = computed(() => todaysSales.value.reduce((sum, sale) => sum + sale.total, 0));
                const todaysTransactionCount = computed(() => todaysSales.value.length);
                const topSellingProducts = computed(() => { const counts = {}; todaysSales.value.forEach(s => s.items.forEach(i => { counts[i.name] = (counts[i.name] || 0) + i.quantity })); return Object.entries(counts).map(([name, sold]) => ({name, sold})).sort((a,b) => b.sold - a.sold).slice(0,5); });
                const weeklySalesChartData = computed(() => { const labels = []; const data = []; for (let i = 6; i >= 0; i--) { const date = dayjs().subtract(i, 'day'); labels.push(date.format('ddd')); const dailySales = props.salesHistory.filter(sale => sale.createdAt && dayjs(sale.createdAt.toDate()).isSame(date, 'day')); data.push(dailySales.reduce((sum, sale) => sum + sale.total, 0)); } return { labels, data }; });
                const dailyReport = computed(() => { const salesOnDate = props.salesHistory.filter(sale => dayjs(sale.createdAt?.toDate()).format('YYYY-MM-DD') === reportDate.value); return { totalRevenue: salesOnDate.reduce((sum, sale) => sum + sale.total, 0), transactionCount: salesOnDate.length, paymentMethods: salesOnDate.reduce((acc, sale) => ({...acc, [sale.paymentMethod]: (acc[sale.paymentMethod] || 0) + sale.total}), {}) }; });
                const renderSalesChart = () => { if (salesChartInstance) salesChartInstance.destroy(); const ctx = salesChartRef.value?.getContext('2d'); if (!ctx) return; salesChartInstance = new Chart(ctx, { type: 'bar', data: { labels: weeklySalesChartData.value.labels, datasets: [{ label: 'Pendapatan', data: weeklySalesChartData.value.data, backgroundColor: 'rgba(54, 162, 235, 0.6)' }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } }); };
                watch([adminTab, () => props.salesHistory], () => { if (adminTab.value === 'dashboard' && salesChartRef.value) { renderSalesChart(); } }, { deep: true, immediate: true });
                const deleteProduct = async (product) => { if (window.confirm(`Yakin mau hapus produk "${product.name}"?`)) { await db.collection('products').doc(product.id).delete(); emit('show-snackbar', { text: "Produk berhasil dihapus.", color: 'bg-gray-500' }); } };
                const tabClass = (tabName) => ['py-2 px-4 font-bold', adminTab.value === tabName ? 'border-blue-500 border-b-2 text-blue-600' : 'text-gray-500 hover:text-gray-700'];
                const stockClass = (stock) => ['px-2 inline-flex text-xs leading-5 font-semibold rounded-full', stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'];
                const downloadReportTxt = () => { const report = dailyReport.value; const dateFormatted = dayjs(reportDate.value).format('dddd, D MMMM YYYY'); let reportText = `Laporan Penjualan Harian\n=============================\nTanggal: ${dateFormatted}\n\nRingkasan Omzet:\n----------------\nTotal Omzet: ${formatCurrency(report.totalRevenue)}\nJumlah Transaksi: ${report.transactionCount}\n\nRincian per Metode Pembayaran:\n------------------------------\n`; if(Object.keys(report.paymentMethods).length > 0) { for (const [method, value] of Object.entries(report.paymentMethods)) { reportText += `${method}: ${formatCurrency(value)}\n`; } } else { reportText += 'Tidak ada transaksi.\n'; } reportText += `=============================`; const blob = new Blob([reportText.trim()], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Laporan_Harian_${reportDate.value}.txt`; a.click(); URL.revokeObjectURL(url); };
                const printDailyReport = () => { const printContents = document.getElementById('daily-report-print-area').innerHTML; const originalContents = document.body.innerHTML; document.body.innerHTML = printContents; window.print(); document.body.innerHTML = originalContents; window.location.reload(); };
                return { adminTab, salesChartRef, reportDate, todaysRevenue, todaysTransactionCount, topSellingProducts, dailyReport, deleteProduct, tabClass, stockClass, formatCurrency, formatTimestamp, dayjs, downloadReportTxt, printDailyReport };
            }
        };

        const App = {
            components: { LoginPage, PosPage, AdminPage },
            template: `
                <div v-if="isLoading" class="flex items-center justify-center h-screen text-xl">Memuat data...</div>
                <div v-else-if="!user.isLoggedIn" class="min-h-screen bg-gray-100 flex flex-col"><LoginPage /></div>
                <div v-else class="flex flex-col h-screen">
                    <header class="bg-blue-500 text-white flex items-center p-4 shadow-md flex-shrink-0 z-20">
                        <button class="md:hidden p-2 rounded-full hover:bg-blue-600" @click="drawer = !drawer"><i class="mdi mdi-menu text-2xl"></i></button>
                        <h1 class="text-xl font-bold ml-4">Kasir Pro</h1><div class="flex-grow"></div>
                        <span class="bg-white text-blue-500 px-3 py-1 rounded-full text-sm mr-2">{{ user.name }}</span>
                        <button class="p-2 rounded-full hover:bg-blue-600" @click="handleLogout"><i class="mdi mdi-logout text-xl"></i></button>
                        <div class="hidden md:flex ml-4 gap-2">
                            <button @click="page = 'pos'" :class="navClass('pos')">Halaman Kasir</button>
                            <button v-if="user.role === 'admin'" @click="page = 'admin'" :class="navClass('admin')">Halaman Admin</button>
                        </div>
                    </header>
                    <div class="flex flex-grow overflow-hidden relative">
                        <aside :class="['bg-gray-800 text-white w-64 p-4 flex-shrink-0 md:hidden absolute md:relative inset-y-0 left-0 transform transition-transform duration-300 ease-in-out z-10', drawer ? 'translate-x-0' : '-translate-x-full']">
                            <nav>
                                <a href="#" @click.prevent="navigate('pos')" :class="mobileNavClass('pos')"><i class="mdi mdi-cash-register mr-2"></i> Halaman Kasir</a>
                                <a v-if="user.role === 'admin'" href="#" @click.prevent="navigate('admin')" :class="mobileNavClass('admin')"><i class="mdi mdi-view-dashboard mr-2"></i> Halaman Admin</a>
                            </nav>
                        </aside>
                        <main class="flex-grow p-4 overflow-y-auto" @click="drawer = false">
                            <PosPage v-if="page === 'pos'" :products="products" :cart-items="cartItems" @update:cartItems="cartItems = $event" @show-snackbar="showSnackbar($event)" @open-payment-dialog="paymentDialog = true" />
                            <AdminPage v-else-if="page === 'admin'" :products="products" :sales-history="salesHistory" @show-snackbar="showSnackbar($event)" @open-product-dialog="openProductDialog($event)" />
                        </main>
                    </div>
                </div>
                <div v-if="paymentDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div class="bg-white rounded-lg shadow-lg w-full max-w-md">
                        <div class="p-4 text-xl font-bold text-white bg-blue-500 rounded-t-lg">Proses Pembayaran</div>
                        <div class="p-6">
                            <div class="flex justify-between text-lg mb-4"><span>Total Belanja:</span><span class="font-bold text-blue-500">{{ formatCurrency(cartTotal) }}</span></div>
                            <label class="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
                            <select v-model="paymentMethod" class="mt-1 w-full p-2 border rounded-md shadow-sm mb-4"><option>Tunai</option><option>QRIS</option><option>Debit</option></select>
                            <template v-if="paymentMethod === 'Tunai'">
                                <label class="block text-sm font-medium text-gray-700">Uang Tunai Diterima</label>
                                <input type="number" v-model.number="cashReceived" class="mt-1 w-full p-2 border rounded-md shadow-sm mb-2" />
                                <div class="flex justify-between text-lg mt-2"><span>Kembalian:</span><span :class="['font-bold', changeAmount < 0 ? 'text-red-500' : 'text-green-500']">{{ formatCurrency(changeAmount) }}</span></div>
                            </template>
                        </div>
                        <div class="flex justify-end p-4 bg-gray-50 rounded-b-lg">
                            <button @click="paymentDialog = false" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md mr-2">Batal</button>
                            <button @click="confirmPayment" :disabled="paymentMethod === 'Tunai' && (changeAmount < 0 || !cashReceived) || isProcessingPayment" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50">{{ isProcessingPayment ? 'Memproses...' : 'Konfirmasi' }}</button>
                        </div>
                    </div>
                </div>
                <div v-if="productDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div class="bg-white rounded-lg shadow-lg w-full max-w-md">
                        <div class="p-4 text-xl font-bold text-white bg-blue-500 rounded-t-lg">{{ productFormTitle }}</div>
                        <div class="p-6 space-y-4">
                            <div><label class="block text-sm font-medium text-gray-700">Nama Produk</label><input type="text" v-model="editedProduct.name" class="mt-1 w-full p-2 border rounded-md shadow-sm" /></div>
                            <div><label class="block text-sm font-medium text-gray-700">Harga</label><input type="number" v-model.number="editedProduct.price" class="mt-1 w-full p-2 border rounded-md shadow-sm" /></div>
                            <div><label class="block text-sm font-medium text-gray-700">Kategori</label><input type="text" v-model="editedProduct.category" class="mt-1 w-full p-2 border rounded-md shadow-sm" /></div>
                            <div><label class="block text-sm font-medium text-gray-700">Stok</label><input type="number" v-model.number="editedProduct.stock" class="mt-1 w-full p-2 border rounded-md shadow-sm" /></div>
                            <div><label class="block text-sm font-medium text-gray-700">URL Gambar</label><input type="text" v-model="editedProduct.image" class="mt-1 w-full p-2 border rounded-md shadow-sm" /></div>
                        </div>
                        <div class="flex justify-end p-4 bg-gray-50 rounded-b-lg">
                            <button @click="productDialog = false" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md mr-2">Batal</button>
                            <button @click="saveProduct" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Simpan</button>
                        </div>
                    </div>
                </div>
                <div v-if="transactionToPrint" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div class="bg-white rounded-lg shadow-lg w-full max-w-sm" style="width: 300px;">
                        <div class="p-4 text-xl font-bold text-white bg-blue-500 rounded-t-lg">Struk Pembayaran</div>
                        <div id="receipt-print-area" class="p-4 font-mono text-xs">
                            <div class="text-center mb-2"><h1 class="text-lg font-bold">Kasir Pro</h1><p>Jalan Contoh No. 123, Bekasi</p></div><hr class="border-dashed my-2"/>
                            <p>No: {{ transactionToPrint.id }}</p><p>Waktu: {{ formatTimestamp(transactionToPrint.createdAt) }}</p><p>Kasir: {{ transactionToPrint.cashier.name }}</p><hr class="border-dashed my-2"/>
                            <div v-for="item in transactionToPrint.items" :key="item.id" class="grid grid-cols-4 gap-1"><p class="col-span-4">{{ item.name }}</p><p class="col-span-1 text-left">{{ item.quantity }}x</p><p class="col-span-2 text-right">@{{ (item.price || 0).toLocaleString('id-ID') }}</p><p class="col-span-1 text-right">{{ (item.price * item.quantity).toLocaleString('id-ID') }}</p></div><hr class="border-dashed my-2"/>
                            <div class="text-right"><p>Subtotal: {{ formatCurrency(transactionToPrint.subtotal) }}</p><p>Pajak: {{ formatCurrency(transactionToPrint.tax) }}</p><p class="font-bold">Total: {{ formatCurrency(transactionToPrint.total) }}</p>
                                <template v-if="transactionToPrint.paymentMethod === 'Tunai'"><p>Tunai: {{ formatCurrency(transactionToPrint.cashReceived) }}</p><p>Kembali: {{ formatCurrency(transactionToPrint.change) }}</p></template>
                                <p>Metode: {{ transactionToPrint.paymentMethod }}</p>
                            </div><hr class="border-dashed my-2"/><p class="text-center">Terima kasih!</p>
                        </div>
                        <div class="flex justify-end p-4 bg-gray-50 rounded-b-lg">
                            <button @click="transactionToPrint = null" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md mr-2">Tutup</button>
                            <button @click="downloadReceiptTxt" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md mr-2">Download TXT</button>
                            <button @click="printReceipt" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md">Cetak</button>
                        </div>
                    </div>
                </div>
                <div v-if="snackbar.show" :class="['fixed bottom-4 right-4 text-white p-4 rounded-lg shadow-lg z-50', snackbar.color]">
                    {{ snackbar.text }}
                </div>`,
            setup() {
                const isLoading = ref(true); const user = ref({ isLoggedIn: false }); const page = ref('pos'); const drawer = ref(false); const products = ref([]); const salesHistory = ref([]); const cartItems = ref([]); const snackbar = ref({ show: false, text: '', color: 'bg-green-500' });
                const paymentDialog = ref(false); const productDialog = ref(false); const transactionToPrint = ref(null);
                const cashReceived = ref(null); const paymentMethod = ref('Tunai'); const isProcessingPayment = ref(false);
                const editedProduct = ref({}); const editedProductId = ref(null);
                const cartSubtotal = computed(() => cartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0)); const cartTax = computed(() => Math.round(cartSubtotal.value * 0.11)); const cartTotal = computed(() => cartSubtotal.value + cartTax.value); const changeAmount = computed(() => (cashReceived.value || 0) - cartTotal.value); const productFormTitle = computed(() => editedProductId.value ? 'Edit Produk' : 'Tambah Produk Baru');
                const showSnackbar = ({ text, color = 'bg-green-500' }) => { snackbar.value = { show: true, text, color }; setTimeout(() => { snackbar.value.show = false; }, 3000); };
                onMounted(() => { auth.onAuthStateChanged(async (firebaseUser) => { if (firebaseUser) { const userDoc = await db.collection('users').doc(firebaseUser.uid).get(); const userData = userDoc.exists ? userDoc.data() : { role: 'kasir' }; user.value = { isLoggedIn: true, uid: firebaseUser.uid, email: firebaseUser.email, role: userData.role, name: userData.name || firebaseUser.email.split('@')[0]}; page.value = userData.role === 'admin' ? 'admin' : 'pos'; loadAppData(); } else { user.value = { isLoggedIn: false }; isLoading.value = false; } }); });
                const loadAppData = () => { db.collection('products').onSnapshot(snap => { products.value = snap.docs.map(d => ({ id: d.id, ...d.data() })); isLoading.value = false; }); db.collection('sales').orderBy('createdAt', 'desc').onSnapshot(snap => { salesHistory.value = snap.docs.map(d => ({ id: d.id, ...d.data() })); }); };
                const handleLogout = () => auth.signOut();
                const navClass = (pageName) => ['py-2 px-4 rounded-lg font-bold', page.value === pageName ? 'bg-blue-700' : 'hover:bg-blue-600'];
                const mobileNavClass = (pageName) => ['flex items-center p-2 mb-2 rounded-lg', page.value === pageName ? 'bg-blue-700' : 'hover:bg-gray-700'];
                const navigate = (pageName) => { page.value = pageName; drawer.value = false; };
                const confirmPayment = async () => { if (isProcessingPayment.value) return; isProcessingPayment.value = true; const batch = db.batch(); const saleRef = db.collection('sales').doc(); let saleData = { items: cartItems.value.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })), subtotal: cartSubtotal.value, tax: cartTax.value, total: cartTotal.value, paymentMethod: paymentMethod.value, createdAt: firebase.firestore.FieldValue.serverTimestamp(), cashier: { email: user.value.email, uid: user.value.uid, name: user.value.name } }; if (paymentMethod.value === 'Tunai') { saleData = { ...saleData, cashReceived: cashReceived.value, change: changeAmount.value }; } batch.set(saleRef, saleData); cartItems.value.forEach(item => { batch.update(db.collection('products').doc(item.id), { stock: firebase.firestore.FieldValue.increment(-item.quantity) }); }); try { await batch.commit(); const newSaleDoc = await saleRef.get(); transactionToPrint.value = { id: newSaleDoc.id, ...newSaleDoc.data() }; showSnackbar({ text: "Transaksi berhasil disimpan!", color: 'bg-green-500' }); cartItems.value = []; paymentDialog.value = false; } catch (error) { showSnackbar({ text: "Gagal menyimpan transaksi!", color: 'bg-red-500' }); } finally { isProcessingPayment.value = false; } };
                const openProductDialog = (product = { name: '', price: 0, category: '', image: '', stock: 0 }) => { editedProductId.value = product.id || null; editedProduct.value = { ...product }; productDialog.value = true; };
                const saveProduct = async () => { const { id, ...productData } = editedProduct.value; try { if (editedProductId.value) await db.collection('products').doc(editedProductId.value).update(productData); else await db.collection('products').add(productData); showSnackbar({text: "Produk berhasil disimpan!", color: "bg-green-500"}); productDialog.value = false; } catch (e) { showSnackbar({text: "Gagal menyimpan produk!", color: "bg-red-500"}); } };
                const downloadReceiptTxt = () => { const trx = transactionToPrint.value; if (!trx) return; let receiptText = `** Kasir Pro **\nJalan Contoh No. 123, Bekasi\n-----------------------------------\nNo: ${trx.id}\nWaktu: ${formatTimestamp(trx.createdAt)}\nKasir: ${trx.cashier.name}\n-----------------------------------\n`; trx.items.forEach(item => { receiptText += `${item.name}\n  ${item.quantity}x @${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}\n`; }); receiptText += `-----------------------------------\nSubtotal: ${formatCurrency(trx.subtotal)}\nPajak (11%): ${formatCurrency(trx.tax)}\nTotal: ${formatCurrency(trx.total)}\n`; if (trx.paymentMethod === 'Tunai') { receiptText += `Tunai: ${formatCurrency(trx.cashReceived)}\nKembali: ${formatCurrency(trx.change)}\n`; } receiptText += `Metode: ${trx.paymentMethod}\n-----------------------------------\n      Terima kasih!\n`; const blob = new Blob([receiptText.trim()], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Struk_${trx.id}.txt`; a.click(); URL.revokeObjectURL(url); };
                const printReceipt = () => { const printContents = document.getElementById('receipt-print-area').innerHTML; const originalContents = document.body.innerHTML; document.body.innerHTML = `<div style="font-family: monospace; font-size: 10pt;">${printContents}</div>`; window.print(); document.body.innerHTML = originalContents; window.location.reload(); };
                return { isLoading, user, page, drawer, products, salesHistory, cartItems, snackbar, paymentDialog, productDialog, transactionToPrint, cashReceived, paymentMethod, isProcessingPayment, editedProduct, cartTotal, changeAmount, productFormTitle, handleLogout, navClass, mobileNavClass, navigate, showSnackbar, confirmPayment, openProductDialog, saveProduct, downloadReceiptTxt, printReceipt, formatCurrency, formatTimestamp };
            }
        };

        // --- INISIALISASI DAN MOUNT APLIKASI VUE ---
        const app = createApp(App);
        app.config.globalProperties.dayjs = dayjs;
        app.config.globalProperties.formatCurrency = formatCurrency;
        app.config.globalProperties.formatTimestamp = formatTimestamp;
        app.mount('#app');
